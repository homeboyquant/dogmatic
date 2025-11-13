import { useState, useEffect, useRef } from 'react';
import styles from './TradingSimulator.module.css';
import Portfolio from './Portfolio';
import type { Position, Trade, Portfolio as PortfolioType } from '@/types/trading';
import { portfolioService } from '@/lib/portfolioService';
import { useAuth } from '@/contexts/AuthContext';

interface Market {
  id: string;
  question: string;
  slug: string;
  outcomePrices: string; // JSON string like "[\"0.25\", \"0.75\"]"
  volume: string;
  outcomes: string; // JSON string like "[\"Yes\", \"No\"]"
  tokens?: { token_id: string; outcome: string }[]; // Token IDs for orderbook
  clobTokenIds?: string[]; // Alternative format for token IDs
  bestBid?: string;
  bestAsk?: string;
  lastTradePrice?: string;
}

interface OrderBook {
  market: string;
  asset_id: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  timestamp: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  image: string;
  markets: Market[];
  slug: string;
}

interface TradingSimulatorProps {
  currentView: 'trading' | 'portfolio';
}

const INITIAL_BALANCE = 500;

export default function TradingSimulator({ currentView }: TradingSimulatorProps) {
  const { userId } = useAuth();
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioType>({
    balance: INITIAL_BALANCE,
    positions: [],
    trades: [],
    totalValue: INITIAL_BALANCE,
    totalPnL: 0,
    totalPnLPercent: 0,
    initialBalance: INITIAL_BALANCE,
  });
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeSide, setTradeSide] = useState<'YES' | 'NO'>('YES');
  const [tradeThesis, setTradeThesis] = useState('');
  const [showTradeSuccess, setShowTradeSuccess] = useState(false);
  const [tradeSuccessMessage, setTradeSuccessMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetAmount, setResetAmount] = useState(String(INITIAL_BALANCE));
  const [orderbooks, setOrderbooks] = useState<Record<string, OrderBook>>({});
  const isInitialMount = useRef(true);
  const lastSavedPortfolio = useRef<string>('');
  const portfolioLoaded = useRef(false);

  // Load portfolio from Firestore when userId is available
  useEffect(() => {
    if (!userId) {
      console.log('⏸️ Waiting for userId...');
      return;
    }

    const loadPortfolio = async () => {
      try {
        // Test Firestore connection
        const { testFirestoreConnection } = await import('@/lib/firebase');
        const testResult = await testFirestoreConnection();

        if (testResult.success) {
          console.log('✅ Firestore test passed:', testResult.data);
        } else {
          console.error('❌ Firestore test failed:', testResult.error);
        }

        // Load portfolio
        console.log('📖 Loading portfolio for user:', userId);
        const savedPortfolio = await portfolioService.getOrCreatePortfolio(userId, INITIAL_BALANCE);
        console.log('✅ Portfolio loaded with', savedPortfolio.trades?.length || 0, 'trades, balance:', savedPortfolio.balance);
        setPortfolio(savedPortfolio);
        portfolioLoaded.current = true;

        // Initialize the lastSavedPortfolio ref with loaded data
        lastSavedPortfolio.current = JSON.stringify({
          balance: savedPortfolio.balance,
          positions: savedPortfolio.positions.map(p => ({ id: p.id, shares: p.shares, cost: p.cost, thesis: p.thesis })),
          trades: savedPortfolio.trades,
        });
      } catch (error) {
        console.error('Error loading portfolio:', error);
      }
    };
    loadPortfolio();
  }, [userId]);

  // Save portfolio whenever it changes (but not on initial mount or price updates)
  useEffect(() => {
    // Skip if portfolio hasn't been loaded yet
    if (!portfolioLoaded.current) {
      console.log('⏸️ Skipping save - portfolio not loaded yet');
      return;
    }

    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      console.log('⏸️ Skipping save - initial mount');
      return;
    }

    if (!userId) {
      console.log('⏸️ Skipping save - no userId');
      return;
    }

    // Only save if trades or positions array changed (not just price updates)
    const currentSnapshot = JSON.stringify({
      balance: portfolio.balance,
      positions: portfolio.positions.map(p => ({ id: p.id, shares: p.shares, cost: p.cost, thesis: p.thesis, polymarketUrl: p.polymarketUrl })),
      trades: portfolio.trades,
    });

    if (currentSnapshot !== lastSavedPortfolio.current) {
      lastSavedPortfolio.current = currentSnapshot;
      console.log('💾 Saving portfolio - trades:', portfolio.trades?.length || 0, ', balance:', portfolio.balance);
      const savePortfolio = async () => {
        try {
          await portfolioService.savePortfolio(userId, portfolio);
          console.log('✅ Portfolio saved successfully');
        } catch (error) {
          console.error('❌ Error saving portfolio:', error);
        }
      };
      savePortfolio();
    }
  }, [portfolio, userId]);

  // Fetch current prices for positions
  useEffect(() => {
    if (portfolio.positions.length === 0) return;

    const fetchPrices = async () => {
      const convertedPositions = portfolio.positions.map(pos => ({
        id: pos.id,
        outcome: pos.side.toLowerCase() as 'yes' | 'no',
        entryPrice: pos.avgPrice,
        marketSlug: pos.marketSlug || '',
      }));

      try {
        const response = await fetch('/api/fetch-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: convertedPositions }),
        });

        const data = await response.json();
        if (data.success && data.prices) {
          setCurrentPrices(data.prices);
        }
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [portfolio.positions]);

  const fetchOrderbooks = async (markets: Market[]) => {
    const orderbookData: Record<string, OrderBook> = {};

    for (const market of markets) {
      const tokenIds = market.clobTokenIds || market.tokens?.map(t => t.token_id) || [];

      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        if (!tokenId) continue;

        try {
          const response = await fetch(`/api/orderbook?token_id=${tokenId}`);
          if (response.ok) {
            const orderbook = await response.json();
            const key = `${market.id}_${i === 0 ? 'YES' : 'NO'}`;
            orderbookData[key] = orderbook;
          }
        } catch (error) {
          console.error(`Error fetching orderbook for ${tokenId}:`, error);
        }
      }
    }

    setOrderbooks(orderbookData);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/events?slug=${encodeURIComponent(slug)}`);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setEvent(data[0]);
        setLoading(false); // Stop loading immediately after event is set

        // Fetch orderbooks in background (don't block UI)
        if (data[0].markets) {
          fetchOrderbooks(data[0].markets).catch(err =>
            console.error('Error fetching orderbooks:', err)
          );
        }
      } else {
        alert('Event not found');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      alert('Failed to fetch event');
      setLoading(false);
    }
  };

  // Update position values when prices change or orderbooks update
  useEffect(() => {
    if (!event) return;

    const updatedPositions = portfolio.positions.map(pos => {
      const market = event.markets.find(m => m.id === pos.marketId);
      if (!market) return pos;

      // Use bid price for current position value (what you could sell for)
      const currentPrice = getBestPrice(market, pos.side, 'SELL');
      const value = pos.shares * currentPrice;
      const pnl = value - pos.cost;
      const pnlPercent = (pnl / pos.cost) * 100;

      return {
        ...pos,
        currentPrice,
        value,
        pnl,
        pnlPercent,
      };
    });

    const totalPositionValue = updatedPositions.reduce((sum, pos) => sum + pos.value, 0);
    const totalPnL = updatedPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    const totalCost = updatedPositions.reduce((sum, pos) => sum + pos.cost, 0);
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    setPortfolio(prev => ({
      ...prev,
      positions: updatedPositions,
      totalValue: prev.balance + totalPositionValue,
      totalPnL,
      totalPnLPercent,
    }));
  }, [event, orderbooks]);

  const getBestPrice = (market: Market, side: 'YES' | 'NO', action: 'BUY' | 'SELL'): number => {
    // First priority: orderbook data for the specific side (most accurate - has separate YES/NO prices)
    const orderbookKey = `${market.id}_${side}`;
    const orderbook = orderbooks[orderbookKey];

    if (orderbook) {
      if (action === 'BUY' && orderbook.asks && orderbook.asks.length > 0) {
        return parseFloat(orderbook.asks[0].price);
      }
      if (action === 'SELL' && orderbook.bids && orderbook.bids.length > 0) {
        return parseFloat(orderbook.bids[0].price);
      }
    }

    // Second: use bestBid/bestAsk from market data (YES side only)
    // Note: bestBid/bestAsk are always for YES side, need to invert for NO
    if (market.bestAsk !== undefined && market.bestBid !== undefined) {
      const yesBestAsk = parseFloat(market.bestAsk);
      const yesBestBid = parseFloat(market.bestBid);

      if (side === 'YES') {
        return action === 'BUY' ? yesBestAsk : yesBestBid;
      } else {
        // For NO side, invert the YES prices
        // NO ask = 1 - YES bid (what you pay to buy NO)
        // NO bid = 1 - YES ask (what you get selling NO)
        return action === 'BUY' ? (1 - yesBestBid) : (1 - yesBestAsk);
      }
    }

    // Fallback to mid price if no bid/ask data available
    const prices = JSON.parse(market.outcomePrices);
    return side === 'YES' ? parseFloat(prices[0]) : parseFloat(prices[1]);
  };

  const calculateExpectedReturn = (price: number, amount: number) => {
    const shares = amount / price;
    const maxReturn = shares * 1.0; // If price goes to $1
    const maxProfit = maxReturn - amount;
    const maxProfitPercent = (maxProfit / amount) * 100;
    const breakEvenPrice = price;

    return {
      shares,
      maxReturn,
      maxProfit,
      maxProfitPercent,
      breakEvenPrice,
    };
  };

  const executeTrade = (action: 'BUY' | 'SELL') => {
    if (!selectedMarket || !tradeAmount) return;

    const dollarAmount = parseFloat(tradeAmount);
    if (isNaN(dollarAmount) || dollarAmount <= 0) {
      alert('Invalid amount');
      return;
    }

    // Use orderbook price: ask for BUY, bid for SELL
    const price = getBestPrice(selectedMarket, tradeSide, action);
    const shares = dollarAmount / price;
    const total = dollarAmount;

    if (action === 'BUY') {
      if (total > portfolio.balance) {
        alert('Insufficient balance');
        return;
      }

      const existingPos = portfolio.positions.find(
        p => p.marketId === selectedMarket.id && p.side === tradeSide
      );

      const trade: Trade = {
        id: Date.now().toString(),
        marketId: selectedMarket.id,
        marketQuestion: selectedMarket.question,
        side: tradeSide,
        action: 'BUY',
        shares,
        price,
        total,
        timestamp: Date.now(),
        thesis: tradeThesis || undefined,
      };

      if (existingPos) {
        const newShares = existingPos.shares + shares;
        const newCost = existingPos.cost + total;
        const newAvgPrice = newCost / newShares;

        setPortfolio(prev => ({
          ...prev,
          balance: prev.balance - total,
          positions: prev.positions.map(p =>
            p.id === existingPos.id
              ? {
                  ...p,
                  shares: newShares,
                  cost: newCost,
                  avgPrice: newAvgPrice,
                  value: newShares * price,
                  pnl: (newShares * price) - newCost,
                  pnlPercent: (((newShares * price) - newCost) / newCost) * 100,
                }
              : p
          ),
          trades: [...prev.trades, trade],
        }));
      } else {
        const position: Position = {
          id: Date.now().toString(),
          marketId: selectedMarket.id,
          marketQuestion: selectedMarket.question,
          marketSlug: selectedMarket.slug,
          eventImage: event?.image,
          side: tradeSide,
          shares,
          avgPrice: price,
          currentPrice: price,
          cost: total,
          value: total,
          pnl: 0,
          pnlPercent: 0,
          timestamp: Date.now(),
          thesis: tradeThesis || undefined,
        };

        setPortfolio(prev => ({
          ...prev,
          balance: prev.balance - total,
          positions: [...prev.positions, position],
          trades: [...prev.trades, trade],
        }));
      }
    } else {
      // SELL
      const existingPos = portfolio.positions.find(
        p => p.marketId === selectedMarket.id && p.side === tradeSide
      );

      if (!existingPos || existingPos.shares < shares) {
        alert('Insufficient shares');
        return;
      }

      const trade: Trade = {
        id: Date.now().toString(),
        marketId: selectedMarket.id,
        marketQuestion: selectedMarket.question,
        side: tradeSide,
        action: 'SELL',
        shares,
        price,
        total,
        timestamp: Date.now(),
        thesis: tradeThesis || undefined,
      };

      const newShares = existingPos.shares - shares;
      const soldCost = (existingPos.cost / existingPos.shares) * shares;
      const newCost = existingPos.cost - soldCost;

      if (newShares === 0) {
        setPortfolio(prev => ({
          ...prev,
          balance: prev.balance + total,
          positions: prev.positions.filter(p => p.id !== existingPos.id),
          trades: [...prev.trades, trade],
        }));
      } else {
        setPortfolio(prev => ({
          ...prev,
          balance: prev.balance + total,
          positions: prev.positions.map(p =>
            p.id === existingPos.id
              ? {
                  ...p,
                  shares: newShares,
                  cost: newCost,
                  avgPrice: newCost / newShares,
                  value: newShares * price,
                  pnl: (newShares * price) - newCost,
                  pnlPercent: (((newShares * price) - newCost) / newCost) * 100,
                }
              : p
          ),
          trades: [...prev.trades, trade],
        }));
      }
    }

    const actionText = action === 'BUY' ? 'Bought' : 'Sold';
    setTradeSuccessMessage(`${actionText} ${shares.toFixed(2)} shares of ${tradeSide} for $${total.toFixed(2)}!`);
    setShowTradeSuccess(true);
    setTimeout(() => setShowTradeSuccess(false), 3000);

    setTradeAmount('');
    setTradeThesis('');
    setSelectedMarket(null);
  };

  const handleResetBalance = () => {
    setShowResetModal(true);
  };

  const confirmReset = async () => {
    const newBalance = parseFloat(resetAmount);
    if (isNaN(newBalance) || newBalance <= 0) {
      alert('Please enter a valid balance');
      return;
    }

    const newPortfolio: PortfolioType = {
      balance: newBalance,
      positions: [],
      trades: [],
      totalValue: newBalance,
      totalPnL: 0,
      totalPnLPercent: 0,
      initialBalance: newBalance,
    };

    setPortfolio(newPortfolio);
    setShowResetModal(false);

    if (!userId) return;
    try {
      await portfolioService.resetPortfolio(userId, newBalance);
    } catch (error) {
      console.error('Error resetting portfolio:', error);
    }
  };

  const handleClosePosition = async (portfolioPosition: { id: string; question: string; outcome: 'yes' | 'no'; entryPrice: number; shares: number; marketSlug: string }) => {
    // Find the actual position in the portfolio
    const position = portfolio.positions.find(p => p.id === portfolioPosition.id);
    if (!position) {
      console.error('❌ Position not found:', portfolioPosition.id);
      return;
    }

    // Fetch current market price from API using bestBid (sell price)
    let currentPrice = position.avgPrice; // Fallback to entry price

    if (portfolioPosition.marketSlug) {
      try {
        const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${portfolioPosition.marketSlug}`);
        const data = await response.json();

        if (data.length > 0) {
          const market = data[0];
          let priceFound = false;

          // Priority 1: Try to get orderbook bestBid (most accurate sell price)
          if (market.clobTokenIds) {
            try {
              const tokenIds = typeof market.clobTokenIds === 'string'
                ? JSON.parse(market.clobTokenIds)
                : market.clobTokenIds;

              const tokenIndex = portfolioPosition.outcome === 'yes' ? 0 : 1;
              const tokenId = tokenIds[tokenIndex];

              if (tokenId) {
                const obResponse = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`);
                if (obResponse.ok) {
                  const orderbook = await obResponse.json();
                  if (orderbook.bids && orderbook.bids.length > 0) {
                    currentPrice = parseFloat(orderbook.bids[0].price);
                    console.log(`✅ Closing ${portfolioPosition.outcome} position at orderbook bestBid: $${currentPrice}`);
                    priceFound = true;
                  }
                }
              }
            } catch (obError) {
              console.log(`⚠️ Orderbook not available, trying bestBid`);
            }
          }

          // Priority 2: Use bestBid from market data
          if (!priceFound && market.bestBid !== undefined) {
            if (portfolioPosition.outcome === 'yes') {
              currentPrice = parseFloat(market.bestBid);
            } else {
              // For NO positions, invert the YES bestAsk
              currentPrice = market.bestAsk ? (1 - parseFloat(market.bestAsk)) : parseFloat(market.bestBid);
            }
            console.log(`✅ Closing ${portfolioPosition.outcome} position at bestBid: $${currentPrice}`);
            priceFound = true;
          }

          // Priority 3: Fallback to outcomePrices
          if (!priceFound) {
            const outcomeIndex = portfolioPosition.outcome === 'yes' ? 0 : 1;
            const prices = JSON.parse(market.outcomePrices);
            currentPrice = parseFloat(prices[outcomeIndex]);
            console.log(`✅ Closing position at outcomePrices: $${currentPrice}`);
          }
        } else {
          console.warn('⚠️ Market not found, using entry price');
        }
      } catch (error) {
        console.error('❌ Error fetching market price:', error);
      }
    }

    const total = position.shares * currentPrice;
    const pnl = total - position.cost;

    const trade: Trade = {
      id: Date.now().toString(),
      marketId: position.marketId,
      marketQuestion: position.marketQuestion,
      side: position.side,
      action: 'SELL',
      shares: position.shares,
      price: currentPrice,
      total,
      timestamp: Date.now(),
    };

    // Mark position as closed instead of removing it
    setPortfolio(prev => ({
      ...prev,
      balance: prev.balance + total,
      positions: prev.positions.map(p =>
        p.id === position.id
          ? {
              ...p,
              closed: true,
              closedAt: Date.now(),
              exitPrice: currentPrice,
              currentPrice: currentPrice,
              value: total,
              pnl: pnl,
              pnlPercent: (pnl / position.cost) * 100
            }
          : p
      ),
      trades: [...prev.trades, trade],
    }));

    setTradeSuccessMessage(`Closed ${position.side} position for $${total.toFixed(2)} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`);
    setShowTradeSuccess(true);
    setTimeout(() => setShowTradeSuccess(false), 3000);
  };

  const handleUpdateThesis = (positionId: string, thesis: string) => {
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(p =>
        p.id === positionId ? { ...p, thesis } : p
      ),
    }));
  };

  const handleUpdatePolymarketUrl = (positionId: string, url: string) => {
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(p =>
        p.id === positionId ? { ...p, polymarketUrl: url } : p
      ),
    }));
  };

  const getPositionForMarket = (market: Market, side: 'YES' | 'NO') => {
    return portfolio.positions.find(p => p.marketId === market.id && p.side === side);
  };

  // Convert positions to Portfolio component format
  const convertedPositions = portfolio.positions.map(pos => ({
    id: pos.id,
    question: pos.marketQuestion,
    outcome: pos.side.toLowerCase() as 'yes' | 'no',
    entryPrice: pos.avgPrice,
    shares: pos.shares,
    marketSlug: pos.marketSlug || event?.slug || '',
    thesis: pos.thesis,
    eventImage: pos.eventImage || event?.image || '',
    closed: pos.closed,
    exitPrice: pos.exitPrice,
    polymarketUrl: pos.polymarketUrl,
  }));

  if (currentView === 'portfolio') {
    return <Portfolio positions={convertedPositions} balance={portfolio.balance} onClose={handleClosePosition} onUpdateThesis={handleUpdateThesis} onUpdatePolymarketUrl={handleUpdatePolymarketUrl} />;
  }

  return (
    <div className={styles.container}>
      {/* Search bar always visible at top */}
      <div className={styles.searchSection}>
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Enter market slug (e.g., trump-popular-vote-2024)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <button type="submit" className={styles.searchButton} disabled={loading}>
            {loading ? (
              <span className={styles.loadingSpinner}>⏳</span>
            ) : (
              <span>Search</span>
            )}
          </button>
        </form>
        {!event && (
          <div className={styles.searchHint}>
            Find prediction markets on <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer">Polymarket</a> and enter their slug to start trading
          </div>
        )}
      </div>

      {/* Portfolio stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Cash Balance</div>
          <div className={styles.statValue}>${portfolio.balance.toFixed(2)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Value</div>
          <div className={styles.statValue}>${(() => {
            const positionsValue = portfolio.positions
              .filter(pos => !pos.closed) // Only count open positions
              .reduce((sum, pos) => {
                const currentPrice = currentPrices[pos.id] || pos.avgPrice;
                return sum + (currentPrice * pos.shares);
              }, 0);
            return (portfolio.balance + positionsValue).toFixed(2);
          })()}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>P&L</div>
          <div className={`${styles.statValue} ${(() => {
            const totalPnL = portfolio.positions.reduce((sum, pos) => {
                // For closed positions, use exitPrice. For open positions, use current price
                const currentPrice = pos.closed && pos.exitPrice
                  ? pos.exitPrice
                  : (currentPrices[pos.id] || pos.avgPrice);
                return sum + ((currentPrice - pos.avgPrice) * pos.shares);
              }, 0);
            return totalPnL >= 0 ? styles.positive : styles.negative;
          })()}`}>
            {(() => {
              const totalPnL = portfolio.positions.reduce((sum, pos) => {
                // For closed positions, use exitPrice. For open positions, use current price
                const currentPrice = pos.closed && pos.exitPrice
                  ? pos.exitPrice
                  : (currentPrices[pos.id] || pos.avgPrice);
                return sum + ((currentPrice - pos.avgPrice) * pos.shares);
              }, 0);
              return `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`;
            })()}
          </div>
        </div>
        <button className={styles.resetButton} onClick={handleResetBalance}>
          Reset Portfolio
        </button>
      </div>

      {event && (
        <>
          <div className={styles.eventSection}>
            <div className={styles.eventHeader}>
              {event.image && (
                <img src={event.image} alt={event.title} className={styles.eventImage} />
              )}
              <div className={styles.eventInfo}>
                <h2 className={styles.eventTitle}>{event.title}</h2>
                <p className={styles.eventDescription}>{event.description}</p>
              </div>
            </div>
          </div>

          <div className={styles.marketsGrid}>
            {event.markets.map((market) => {
              // Use ask prices for display (what you'd pay to buy)
              const yesAskPrice = getBestPrice(market, 'YES', 'BUY');
              const noAskPrice = getBestPrice(market, 'NO', 'BUY');
              const yesPosition = getPositionForMarket(market, 'YES');
              const noPosition = getPositionForMarket(market, 'NO');

              return (
                <div key={market.id} className={styles.marketCard}>
                  <div className={styles.marketQuestion}>{market.question}</div>

                  <div className={styles.outcomesRow}>
                    <div className={`${styles.outcomeCard} ${styles.yes}`}>
                      <div className={styles.outcomeHeader}>
                        <div className={styles.outcomeLabel}>YES</div>
                        <div className={styles.outcomePrice}>{Math.round(yesAskPrice * 100)}¢</div>
                      </div>
                      {yesPosition && (
                        <div className={styles.positionInfo}>
                          <span>{yesPosition.shares.toFixed(0)} shares</span>
                          <span className={yesPosition.pnl >= 0 ? styles.positive : styles.negative}>
                            {yesPosition.pnl >= 0 ? '+' : ''}${yesPosition.pnl.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <button
                        className={styles.tradeButton}
                        onClick={() => { setSelectedMarket(market); setTradeSide('YES'); }}
                      >
                        Trade YES
                      </button>
                    </div>

                    <div className={`${styles.outcomeCard} ${styles.no}`}>
                      <div className={styles.outcomeHeader}>
                        <div className={styles.outcomeLabel}>NO</div>
                        <div className={styles.outcomePrice}>{Math.round(noAskPrice * 100)}¢</div>
                      </div>
                      {noPosition && (
                        <div className={styles.positionInfo}>
                          <span>{noPosition.shares.toFixed(0)} shares</span>
                          <span className={noPosition.pnl >= 0 ? styles.positive : styles.negative}>
                            {noPosition.pnl >= 0 ? '+' : ''}${noPosition.pnl.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <button
                        className={styles.tradeButton}
                        onClick={() => { setSelectedMarket(market); setTradeSide('NO'); }}
                      >
                        Trade NO
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Trade Modal */}
      {selectedMarket && (
        <div className={styles.tradeModal} onClick={() => setSelectedMarket(null)}>
          <div className={styles.tradeModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setSelectedMarket(null)}>✕</button>

            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Trade {tradeSide}</h3>
              <div className={`${styles.modalSideBadge} ${tradeSide === 'YES' ? styles.yes : styles.no}`}>
                {tradeSide}
              </div>
            </div>

            <p className={styles.modalQuestion}>{selectedMarket.question}</p>

            <div className={styles.tradeForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Amount (USD)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  placeholder="0.00"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  step="0.01"
                  min="0.01"
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Trade Thesis (Optional)</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Why are you making this trade?"
                  value={tradeThesis}
                  onChange={(e) => setTradeThesis(e.target.value)}
                  rows={3}
                />
              </div>

              {tradeAmount && parseFloat(tradeAmount) > 0 && (
                <div className={styles.expectedReturns}>
                  <div className={styles.returnsTitle}>Expected Returns</div>
                  {(() => {
                    // Use ask price for buy calculations
                    const price = getBestPrice(selectedMarket, tradeSide, 'BUY');
                    const amount = parseFloat(tradeAmount);
                    const expected = calculateExpectedReturn(price, amount);

                    return (
                      <>
                        <div className={styles.returnRow}>
                          <span className={styles.returnLabel}>You'll receive:</span>
                          <span className={styles.returnValue}>{expected.shares.toFixed(2)} shares</span>
                        </div>
                        <div className={styles.returnRow}>
                          <span className={styles.returnLabel}>Price per share:</span>
                          <span className={styles.returnValue}>${price.toFixed(3)}</span>
                        </div>
                        <div className={styles.returnRow}>
                          <span className={styles.returnLabel}>Max return:</span>
                          <span className={`${styles.returnValue} ${styles.positive}`}>
                            ${expected.maxReturn.toFixed(2)}
                          </span>
                        </div>
                        <div className={styles.returnRow}>
                          <span className={styles.returnLabel}>Max profit:</span>
                          <span className={`${styles.returnValue} ${styles.positive}`}>
                            +${expected.maxProfit.toFixed(2)} (+{expected.maxProfitPercent.toFixed(1)}%)
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className={styles.tradeActions}>
                <button
                  className={`${styles.actionButton} ${tradeSide === 'YES' ? styles.buyYes : styles.buyNo}`}
                  onClick={() => executeTrade('BUY')}
                  disabled={!tradeAmount || parseFloat(tradeAmount) <= 0}
                >
                  Buy {tradeSide}
                </button>
                {(() => {
                  // Only show Sell button if user has a position in this market and side
                  const existingPosition = portfolio.positions.find(
                    p => p.marketId === selectedMarket.id && p.side === tradeSide
                  );
                  if (!existingPosition) return null;

                  return (
                    <button
                      className={`${styles.actionButton} ${styles.sell}`}
                      onClick={() => executeTrade('SELL')}
                      disabled={!tradeAmount || parseFloat(tradeAmount) <= 0}
                    >
                      Sell {tradeSide}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className={styles.tradeModal} onClick={() => setShowResetModal(false)}>
          <div className={styles.tradeModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setShowResetModal(false)}>✕</button>

            <h3 className={styles.modalTitle}>Reset Portfolio</h3>
            <p className={styles.modalQuestion}>
              This will clear all positions and trades. Enter your new starting balance.
            </p>

            <div className={styles.tradeForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Starting Balance (USD)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  placeholder="5000.00"
                  value={resetAmount}
                  onChange={(e) => setResetAmount(e.target.value)}
                  step="100"
                  min="1"
                />
              </div>

              <div className={styles.tradeActions}>
                <button
                  className={`${styles.actionButton} ${styles.cancel}`}
                  onClick={() => setShowResetModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.actionButton} ${styles.sell}`}
                  onClick={confirmReset}
                >
                  Reset Portfolio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {showTradeSuccess && (
        <div className={styles.successToast}>
          <div className={styles.toastIcon}>✓</div>
          <div className={styles.toastMessage}>{tradeSuccessMessage}</div>
        </div>
      )}
    </div>
  );
}
