/**
 * Real Trading Service
 * Manages real trades, positions, and PnL calculations
 */

import { buy_fast, sell_fast, ApiResponse } from './tradingApi';
import { portfolioService } from './portfolioService';
import type { Position, Trade, Portfolio as PortfolioType } from '@/types/trading';

const PRIVATE_KEY = process.env.NEXT_PUBLIC_TRADING_PRIVATE_KEY || process.env.TRADING_PRIVATE_KEY;

export interface RealTrade {
  orderID: string;
  tokenId: string;
  side: 'YES' | 'NO';
  type: 'BUY' | 'SELL';
  sizeMatched: number;
  totalUsdFilled: number;
  avgPrice: number;
  timestamp: number;
  marketId: string;
  marketQuestion: string;
  status: 'matched' | 'live' | 'partial';
}

export interface RealPosition {
  id: string; // Same as Firestore position ID
  orderID: string;
  tokenId: string;
  marketId: string;
  marketQuestion: string;
  marketSlug: string;
  side: 'YES' | 'NO';
  shares: number; // Total shares owned
  avgPrice: number; // Average entry price
  cost: number; // Total cost basis
  currentPrice: number; // Current market price
  value: number; // Current value (shares * currentPrice)
  pnl: number; // Unrealized PnL
  pnlPercent: number;
  timestamp: number;
  eventImage?: string;
  thesis?: string;
  closed?: boolean;
  exitPrice?: number;
  exitOrderID?: string;
}

class RealTradingService {
  /**
   * Execute a buy order
   */
  async executeBuy(
    tokenId: string,
    amount: number,
    marketData: {
      marketId: string;
      marketQuestion: string;
      marketSlug: string;
      side: 'YES' | 'NO';
      eventImage?: string;
    },
    thesis?: string
  ): Promise<{ success: boolean; trade?: RealTrade; error?: string }> {
    try {
      console.log(`🔵 Executing BUY: ${marketData.marketQuestion} (${marketData.side}) - $${amount}`);

      const response = await buy_fast(tokenId, amount);

      if (response.status === 'success' && response.response) {
        const trade: RealTrade = {
          orderID: response.response.orderID,
          tokenId,
          side: marketData.side,
          type: 'BUY',
          sizeMatched: response.response.size_matched || 0,
          totalUsdFilled: response.response.total_usd_filled || amount,
          avgPrice: (response.response.total_usd_filled || amount) / (response.response.size_matched || 1),
          timestamp: Date.now(),
          marketId: marketData.marketId,
          marketQuestion: marketData.marketQuestion,
          status: response.response.status,
        };

        console.log(`✅ Buy executed successfully! Order ID: ${trade.orderID}`);
        return { success: true, trade };
      } else {
        console.error('❌ Buy failed:', response);
        return { success: false, error: response.response || 'Buy failed' };
      }
    } catch (error: any) {
      console.error('❌ Buy error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a sell order
   */
  async executeSell(
    tokenId: string,
    orderID: string,
    sellPercentage: number,
    marketData: {
      marketId: string;
      marketQuestion: string;
      side: 'YES' | 'NO';
    }
  ): Promise<{ success: boolean; trade?: RealTrade; error?: string }> {
    try {
      console.log(`🔴 Executing SELL: ${marketData.marketQuestion} (${marketData.side}) - ${sellPercentage}%`);

      const response = await sell_fast(tokenId, orderID, sellPercentage);

      if (response.status === 'success' && response.response) {
        const trade: RealTrade = {
          orderID: response.response.orderID,
          tokenId,
          side: marketData.side,
          type: 'SELL',
          sizeMatched: response.response.size_matched || 0,
          totalUsdFilled: 0, // We'll calculate this based on current price
          avgPrice: 0,
          timestamp: Date.now(),
          marketId: marketData.marketId,
          marketQuestion: marketData.marketQuestion,
          status: response.response.status,
        };

        console.log(`✅ Sell executed successfully! Order ID: ${trade.orderID}`);
        return { success: true, trade };
      } else {
        console.error('❌ Sell failed:', response);
        return { success: false, error: response.response || 'Sell failed' };
      }
    } catch (error: any) {
      console.error('❌ Sell error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update portfolio with a new buy trade
   */
  async processBuyTrade(
    userId: string,
    currentPortfolio: PortfolioType,
    trade: RealTrade,
    marketData: {
      marketId: string;
      marketQuestion: string;
      marketSlug: string;
      eventImage?: string;
    },
    thesis?: string
  ): Promise<PortfolioType> {
    // Find existing position or create new one
    const existingPos = (currentPortfolio.positions || []).find(
      p => p.marketId === marketData.marketId && p.side === trade.side && !p.closed
    );

    const firestoreTrade: Trade = {
      id: trade.orderID,
      marketId: marketData.marketId,
      marketQuestion: marketData.marketQuestion,
      side: trade.side,
      action: 'BUY',
      shares: trade.sizeMatched,
      price: trade.avgPrice,
      total: trade.totalUsdFilled,
      timestamp: trade.timestamp,
      thesis,
    };

    if (existingPos) {
      // Add to existing position
      const newShares = existingPos.shares + trade.sizeMatched;
      const newCost = existingPos.cost + trade.totalUsdFilled;
      const newAvgPrice = newCost / newShares;

      const updatedPositions = (currentPortfolio.positions || []).map(p =>
        p.id === existingPos.id
          ? {
              ...p,
              shares: newShares,
              cost: newCost,
              avgPrice: newAvgPrice,
              value: newShares * p.currentPrice,
              pnl: (newShares * p.currentPrice) - newCost,
              pnlPercent: (((newShares * p.currentPrice) - newCost) / newCost) * 100,
            }
          : p
      );

      const updatedPortfolio = {
        ...currentPortfolio,
        positions: updatedPositions,
        trades: [...(currentPortfolio.trades || []), firestoreTrade],
      };

      await portfolioService.savePortfolio(userId, updatedPortfolio);
      return updatedPortfolio;
    } else {
      // Create new position
      const newPosition: Position = {
        id: trade.orderID,
        orderID: trade.orderID, // Store original buy order ID for selling
        tokenId: trade.tokenId, // Store token ID for selling
        marketId: marketData.marketId,
        marketQuestion: marketData.marketQuestion,
        marketSlug: marketData.marketSlug,
        eventImage: marketData.eventImage,
        side: trade.side,
        shares: trade.sizeMatched,
        avgPrice: trade.avgPrice,
        currentPrice: trade.avgPrice,
        cost: trade.totalUsdFilled,
        value: trade.totalUsdFilled,
        pnl: 0,
        pnlPercent: 0,
        timestamp: trade.timestamp,
        thesis,
      };

      const updatedPortfolio = {
        ...currentPortfolio,
        positions: [...(currentPortfolio.positions || []), newPosition],
        trades: [...(currentPortfolio.trades || []), firestoreTrade],
      };

      await portfolioService.savePortfolio(userId, updatedPortfolio);
      return updatedPortfolio;
    }
  }

  /**
   * Update portfolio with a sell trade
   */
  async processSellTrade(
    userId: string,
    currentPortfolio: PortfolioType,
    trade: RealTrade,
    currentPrice: number,
    positionId: string
  ): Promise<PortfolioType> {
    const position = (currentPortfolio.positions || []).find(p => p.id === positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    const soldValue = trade.sizeMatched * currentPrice;
    const soldCost = (position.cost / position.shares) * trade.sizeMatched;

    const firestoreTrade: Trade = {
      id: trade.orderID,
      marketId: trade.marketId,
      marketQuestion: trade.marketQuestion,
      side: trade.side,
      action: 'SELL',
      shares: trade.sizeMatched,
      price: currentPrice,
      total: soldValue,
      timestamp: trade.timestamp,
    };

    const newShares = position.shares - trade.sizeMatched;

    let updatedPositions;
    if (newShares <= 0.01) {
      // Close position completely - keep original shares for P&L calculation
      const originalShares = position.shares;
      const realizedPnL = (currentPrice - position.avgPrice) * originalShares;

      updatedPositions = (currentPortfolio.positions || []).map(p =>
        p.id === positionId
          ? {
              ...p,
              closed: true,
              closedAt: Date.now(),
              exitPrice: currentPrice,
              exitOrderID: trade.orderID,
              originalShares, // Store original shares for display
              shares: originalShares, // Keep shares for P&L calculation
              value: 0, // Position no longer has value
              pnl: realizedPnL, // Store realized P&L
              pnlPercent: (realizedPnL / position.cost) * 100,
            }
          : p
      );
    } else {
      // Partially close position
      const newCost = position.cost - soldCost;
      updatedPositions = (currentPortfolio.positions || []).map(p =>
        p.id === positionId
          ? {
              ...p,
              shares: newShares,
              cost: newCost,
              avgPrice: newCost / newShares,
              value: newShares * currentPrice,
              pnl: (newShares * currentPrice) - newCost,
              pnlPercent: (((newShares * currentPrice) - newCost) / newCost) * 100,
            }
          : p
      );
    }

    const updatedPortfolio = {
      ...currentPortfolio,
      positions: updatedPositions,
      trades: [...(currentPortfolio.trades || []), firestoreTrade],
    };

    await portfolioService.savePortfolio(userId, updatedPortfolio);
    return updatedPortfolio;
  }

  /**
   * Calculate total PnL from positions
   */
  calculatePnL(positions: Position[]): { total: number; realized: number; unrealized: number } {
    const safePositions = positions || [];

    const realized = safePositions
      .filter(p => p.closed)
      .reduce((sum, p) => {
        const exitPrice = p.exitPrice || p.avgPrice;
        return sum + ((exitPrice - p.avgPrice) * p.shares);
      }, 0);

    const unrealized = safePositions
      .filter(p => !p.closed)
      .reduce((sum, p) => sum + p.pnl, 0);

    return {
      total: realized + unrealized,
      realized,
      unrealized,
    };
  }
}

export const realTradingService = new RealTradingService();
