/**
 * Polymarket Service
 * Transforms Polymarket CLOB orders and trades into our Position format
 */

import type { Position } from '@/types/trading';

interface PolymarketOrder {
  id: string;
  market: string;
  asset_id: string;
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
  status: 'LIVE' | 'PARTIAL' | 'MATCHED' | 'CANCELLED' | 'EXPIRED';
  created_at: string;
  updated_at?: string;
  outcome?: string;
  size_matched?: string;
  avg_price?: string;
}

interface PolymarketTrade {
  id: string;
  market: string;
  asset_id: string;
  side: 'BUY' | 'SELL';
  price: string;
  size: string;
  timestamp: string;
  outcome?: string;
}

interface MarketInfo {
  id: string;
  question: string;
  slug: string;
  image?: string;
  tokens?: { token_id: string; outcome: string }[];
}

class PolymarketService {
  /**
   * Fetch user's orders and trades from Polymarket
   */
  async fetchUserOrders(): Promise<{
    success: boolean;
    openOrders: PolymarketOrder[];
    closedOrders: PolymarketOrder[];
    trades: PolymarketTrade[];
    error?: string;
  }> {
    try {
      const response = await fetch('/api/polymarket-orders');
      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          openOrders: [],
          closedOrders: [],
          trades: [],
          error: data.error,
        };
      }

      return {
        success: true,
        openOrders: data.openOrders || [],
        closedOrders: data.closedOrders || [],
        trades: data.trades || [],
      };
    } catch (error: any) {
      // Silently fail - likely API key configuration issue
      return {
        success: false,
        openOrders: [],
        closedOrders: [],
        trades: [],
        error: error.message,
      };
    }
  }

  /**
   * Fetch market information for a token ID
   */
  async fetchMarketInfo(tokenId: string): Promise<MarketInfo | null> {
    try {
      // Search for market by token ID
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?closed=false&archived=false`
      );
      const markets = await response.json();

      if (!Array.isArray(markets)) {
        return null;
      }

      // Find market that contains this token ID
      for (const market of markets) {
        if (market.tokens) {
          const token = market.tokens.find((t: any) => t.token_id === tokenId);
          if (token) {
            return {
              id: market.condition_id || market.id,
              question: market.question,
              slug: market.slug,
              image: market.image,
              tokens: market.tokens,
            };
          }
        }

        // Also check clobTokenIds
        if (market.clobTokenIds) {
          const tokenIds = typeof market.clobTokenIds === 'string'
            ? JSON.parse(market.clobTokenIds)
            : market.clobTokenIds;

          if (tokenIds.includes(tokenId)) {
            return {
              id: market.condition_id || market.id,
              question: market.question,
              slug: market.slug,
              image: market.image,
              tokens: market.tokens,
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Error fetching market info for token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get outcome (YES/NO) from token ID and market info
   */
  getOutcomeFromTokenId(tokenId: string, marketInfo: MarketInfo): 'YES' | 'NO' {
    if (!marketInfo.tokens) {
      return 'YES'; // Default fallback
    }

    const token = marketInfo.tokens.find(t => t.token_id === tokenId);
    if (token) {
      return token.outcome.toUpperCase() as 'YES' | 'NO';
    }

    // If tokens array doesn't have outcome, check position in clobTokenIds
    // First token is YES, second is NO
    return 'YES'; // Default fallback
  }

  /**
   * Transform Polymarket orders into Position objects
   */
  async transformOrdersToPositions(
    orders: PolymarketOrder[],
    trades: PolymarketTrade[]
  ): Promise<Position[]> {
    const positions: Position[] = [];

    // Group buy orders by token ID to calculate positions
    const buyOrdersByToken = new Map<string, PolymarketOrder[]>();
    const sellOrdersByToken = new Map<string, PolymarketOrder[]>();

    for (const order of orders) {
      if (order.side === 'BUY') {
        const existing = buyOrdersByToken.get(order.asset_id) || [];
        buyOrdersByToken.set(order.asset_id, [...existing, order]);
      } else if (order.side === 'SELL') {
        const existing = sellOrdersByToken.get(order.asset_id) || [];
        sellOrdersByToken.set(order.asset_id, [...existing, order]);
      }
    }

    // Create positions from buy orders
    for (const [tokenId, buyOrders] of buyOrdersByToken) {
      // Fetch market info
      const marketInfo = await this.fetchMarketInfo(tokenId);
      if (!marketInfo) {
        console.warn(`⚠️ Could not find market info for token ${tokenId}`);
        continue;
      }

      const outcome = this.getOutcomeFromTokenId(tokenId, marketInfo);

      // Calculate total shares and cost from all buy orders
      let totalShares = 0;
      let totalCost = 0;
      let oldestTimestamp = Date.now();

      for (const order of buyOrders) {
        const sizeMatched = parseFloat(order.size_matched || order.size || '0');
        const avgPrice = parseFloat(order.avg_price || order.price || '0');

        totalShares += sizeMatched;
        totalCost += sizeMatched * avgPrice;
        oldestTimestamp = Math.min(oldestTimestamp, new Date(order.created_at).getTime());
      }

      if (totalShares === 0) continue;

      const avgPrice = totalCost / totalShares;

      // Check if there are any sell orders for this token
      const sellOrders = sellOrdersByToken.get(tokenId) || [];
      let soldShares = 0;
      let soldValue = 0;

      for (const sellOrder of sellOrders) {
        const sizeMatched = parseFloat(sellOrder.size_matched || sellOrder.size || '0');
        const avgPrice = parseFloat(sellOrder.avg_price || sellOrder.price || '0');

        soldShares += sizeMatched;
        soldValue += sizeMatched * avgPrice;
      }

      const remainingShares = totalShares - soldShares;
      const isClosed = remainingShares <= 0.01;

      // Create position
      const position: Position = {
        id: buyOrders[0].id, // Use first buy order ID
        orderID: buyOrders[0].id, // Store original buy order ID for selling
        tokenId: tokenId, // Store token ID for selling
        marketId: marketInfo.id,
        marketQuestion: marketInfo.question,
        marketSlug: marketInfo.slug,
        eventImage: marketInfo.image,
        side: outcome,
        shares: isClosed ? totalShares : remainingShares, // Keep original shares if closed for P&L calc
        avgPrice: avgPrice,
        currentPrice: avgPrice, // Will be updated by price fetch
        cost: isClosed ? totalCost : (totalCost / totalShares) * remainingShares,
        value: isClosed ? 0 : remainingShares * avgPrice,
        pnl: isClosed ? soldValue - totalCost : 0,
        pnlPercent: isClosed ? ((soldValue - totalCost) / totalCost) * 100 : 0,
        timestamp: oldestTimestamp,
        closed: isClosed,
        closedAt: isClosed ? new Date(sellOrders[sellOrders.length - 1]?.updated_at || Date.now()).getTime() : undefined,
        exitPrice: isClosed && sellOrders.length > 0 ? soldValue / soldShares : undefined,
        exitOrderID: isClosed && sellOrders.length > 0 ? sellOrders[0].id : undefined,
        originalShares: isClosed ? totalShares : undefined,
      };

      positions.push(position);
    }

    return positions;
  }

  /**
   * Sync portfolio with real Polymarket orders
   */
  async syncPortfolioWithPolymarket(): Promise<{
    success: boolean;
    positions: Position[];
    error?: string;
  }> {
    try {
      console.log('🔄 Syncing portfolio with Polymarket...');

      // Fetch orders and trades
      const { success, openOrders, closedOrders, trades, error } = await this.fetchUserOrders();

      if (!success) {
        return { success: false, positions: [], error };
      }

      console.log(`📊 Found ${openOrders.length} open orders, ${closedOrders.length} closed orders, ${trades.length} trades`);

      // Transform orders to positions
      const allOrders = [...openOrders, ...closedOrders];
      const positions = await this.transformOrdersToPositions(allOrders, trades);

      console.log(`✅ Transformed ${positions.length} positions from Polymarket`);

      return {
        success: true,
        positions,
      };
    } catch (error: any) {
      console.error('❌ Error syncing with Polymarket:', error);
      return {
        success: false,
        positions: [],
        error: error.message,
      };
    }
  }
}

export const polymarketService = new PolymarketService();
