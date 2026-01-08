import { useState, useEffect, useRef } from 'react';
import styles from './TradingSimulator.module.css';
import Portfolio from './Portfolio';
import Toast from './Toast';
import Leaderboard from './Leaderboard';
import type { Position, Trade, Portfolio as PortfolioType, PerformanceSnapshot } from '@/types/trading';
import { portfolioService } from '@/lib/portfolioService';
import { useAuth } from '@/contexts/AuthContext';
import { realTradingService } from '@/lib/realTradingService';
import { buy_fast, sell_fast } from '@/lib/tradingApi';
import { polymarketService } from '@/lib/polymarketService';
import { soundService } from '@/lib/sounds';
import { searchService, type SearchEvent } from '@/lib/searchService';

interface Market {
  id: string;
  question: string;
  slug: string;
  outcomePrices: string;
  volume: string;
  outcomes: string;
  tokens?: { token_id: string; outcome: string }[];
  clobTokenIds?: string[];
  bestBid?: string;
  bestAsk?: string;
  lastTradePrice?: string;
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

export default function RealTradingSimulator({ currentView }: TradingSimulatorProps) {
  const { userId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchEvent[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
  const [tradingInProgress, setTradingInProgress] = useState(false);
  const [sellingPositionId, setSellingPositionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const isInitialMount = useRef(true);
  const lastSavedPortfolio = useRef<string>('');
  const portfolioLoaded = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load portfolio from Firestore
  useEffect(() => {
    if (!userId) return;

    const loadPortfolio = async () => {
      try {
        const savedPortfolio = await portfolioService.getOrCreatePortfolio(userId, INITIAL_BALANCE);
        console.log('✅ Portfolio loaded:', savedPortfolio);
        setPortfolio(savedPortfolio);
        portfolioLoaded.current = true;

        lastSavedPortfolio.current = JSON.stringify({
          balance: savedPortfolio.balance,
          positions: savedPortfolio.positions.map(p => ({ id: p.id, shares: p.shares, cost: p.cost })),
          trades: savedPortfolio.trades,
        });
      } catch (error) {
        console.error('Error loading portfolio:', error);
      }
    };
    loadPortfolio();
  }, [userId]);

  // Auto-sync with Polymarket every 20 seconds when viewing portfolio
  useEffect(() => {
    if (!userId || currentView !== 'portfolio') return;

    const syncWithPolymarket = async () => {
      console.log('🔄 Auto-syncing portfolio with Polymarket...');

      try {
        const result = await polymarketService.syncPortfolioWithPolymarket();

        if (result.success && result.positions.length > 0) {
          // Merge Polymarket positions with existing portfolio
          // Keep local positions and add any new Polymarket positions
          const localPositionIds = new Set((portfolio.positions || []).map(p => p.id));
          const newPositions = result.positions.filter(p => !localPositionIds.has(p.id));

          if (newPositions.length > 0) {
            console.log(`✅ Auto-synced ${newPositions.length} new positions from Polymarket`);

            const updatedPortfolio = {
              ...portfolio,
              positions: [...(portfolio.positions || []), ...newPositions],
            };

            setPortfolio(updatedPortfolio);
            await portfolioService.savePortfolio(userId, updatedPortfolio);
          } else {
            console.log('✅ Portfolio already in sync with Polymarket');
          }
        } else if (result.error) {
          // Silently ignore unauthorized/API key errors
          if (!result.error.includes('Unauthorized') && !result.error.includes('api key')) {
            console.error(`❌ Sync failed: ${result.error}`);
          }
        }
      } catch (error: any) {
        // Silently ignore sync errors (likely API key not configured)
        if (error.message && !error.message.includes('Unauthorized') && !error.message.includes('api key')) {
          console.error('❌ Auto-sync error:', error);
        }
      }
    };

    // Sync immediately when portfolio opens
    syncWithPolymarket();

    // Then sync every 20 seconds
    const interval = setInterval(syncWithPolymarket, 20000);

    return () => clearInterval(interval);
  }, [userId, currentView, portfolio.positions]);

  // Save portfolio changes
  useEffect(() => {
    if (!portfolioLoaded.current || isInitialMount.current || !userId) {
      if (isInitialMount.current) isInitialMount.current = false;
      return;
    }

    const currentSnapshot = JSON.stringify({
      balance: portfolio.balance,
      positions: (portfolio.positions || []).map(p => ({ id: p.id, shares: p.shares, cost: p.cost })),
      trades: portfolio.trades || [],
    });

    if (currentSnapshot !== lastSavedPortfolio.current) {
      lastSavedPortfolio.current = currentSnapshot;
      portfolioService.savePortfolio(userId, portfolio).catch(console.error);
    }
  }, [portfolio, userId]);

  // Helper function to add P&L snapshot to portfolio history
  const addPnLSnapshot = (portfolio: PortfolioType): PortfolioType => {
    const pnlData = realTradingService.calculatePnL(portfolio.positions);
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      balance: portfolio.balance,
      totalValue: portfolio.totalValue,
      totalPnL: pnlData.total,
    };

    const history = portfolio.pnlHistory || [];
    // Keep last 100 snapshots to avoid bloating the document
    const updatedHistory = [...history, snapshot].slice(-100);

    console.log('📊 Added P&L snapshot:', snapshot);

    return {
      ...portfolio,
      pnlHistory: updatedHistory,
    };
  };

  // Fetch prices for open positions
  useEffect(() => {
    if (!portfolio.positions || portfolio.positions.length === 0) return;

    const fetchPrices = async () => {
      const convertedPositions = (portfolio.positions || []).map(pos => ({
        id: pos.id,
        marketId: pos.marketId,
        outcome: pos.side.toLowerCase() as 'yes' | 'no',
        entryPrice: pos.avgPrice,
        marketSlug: pos.marketSlug || '',
        marketQuestion: pos.marketQuestion,
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
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [portfolio.positions]);

  // Real-time search as user types
  const handleSearchInput = async (query: string) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchService.searchMarkets(query, 10);
        setSearchResults(results.events || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
    }, 300);
  };

  // Select event from search results
  const handleSelectEvent = (selectedEvent: SearchEvent) => {
    setEvent(selectedEvent as any);
    setSearchQuery(selectedEvent.title);
    setShowSuggestions(false);
  };

  // Handle form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    console.log('🔎 Search submitted:', searchQuery);
    console.log('📋 Current search results:', searchResults.length);

    setLoading(true);
    setShowSuggestions(false);

    try {
      // If we already have results, use the first one
      if (searchResults.length > 0) {
        console.log('✅ Using cached result:', searchResults[0].title);
        setEvent(searchResults[0] as any);
      } else {
        // Otherwise search
        console.log('🔍 Performing new search...');
        const results = await searchService.searchMarkets(searchQuery, 10);
        console.log('📊 Search completed. Results:', results.events?.length || 0);

        if (results.events && results.events.length > 0) {
          console.log('✅ Setting event:', results.events[0].title);
          setEvent(results.events[0] as any);
        } else {
          console.warn('⚠️ No results found');
          setToastMessage(`No markets found for "${searchQuery}". Try different keywords.`);
          setToastType('error');
        }
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setToastMessage('Search failed. Please try again.');
      setToastType('error');
    }
    setLoading(false);
  };

  const getBestPrice = (market: Market, side: 'YES' | 'NO'): number => {
    if (!market.outcomePrices) {
      return 0.5; // Default price if no outcome prices available
    }
    try {
      const prices = typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices;
      return side === 'YES' ? parseFloat(prices[0]) : parseFloat(prices[1]);
    } catch (error) {
      console.error('Error parsing outcome prices:', error);
      return 0.5; // Default price on parse error
    }
  };

  const getTokenId = (market: Market, side: 'YES' | 'NO'): string | null => {
    // Try clobTokenIds first (might be array or JSON string)
    if (market.clobTokenIds) {
      try {
        const tokenIds = typeof market.clobTokenIds === 'string'
          ? JSON.parse(market.clobTokenIds)
          : market.clobTokenIds;

        if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
          const tokenId = side === 'YES' ? tokenIds[0] : tokenIds[1];
          console.log(`✅ Token ID for ${side}:`, tokenId);
          return tokenId;
        }
      } catch (e) {
        console.error('Error parsing clobTokenIds:', e);
      }
    }

    // Fallback to tokens array
    if (market.tokens && market.tokens.length >= 2) {
      const token = market.tokens.find(t => t.outcome.toUpperCase() === side);
      if (token?.token_id) {
        console.log(`✅ Token ID for ${side} (from tokens):`, token.token_id);
        return token.token_id;
      }
    }

    console.error('❌ No token ID found for', side, 'in market:', market);
    return null;
  };

  const executeBuy = async () => {
    if (!selectedMarket || !tradeAmount || !userId) return;

    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount');
      return;
    }

    const tokenId = getTokenId(selectedMarket, tradeSide);
    if (!tokenId) {
      alert('Token ID not found for this market');
      return;
    }

    setTradingInProgress(true);

    try {
      console.log('🔵 Executing real BUY order...');

      const result = await realTradingService.executeBuy(
        tokenId,
        amount,
        {
          marketId: selectedMarket.id,
          marketQuestion: selectedMarket.question,
          marketSlug: selectedMarket.slug,
          side: tradeSide,
          eventImage: event?.image,
        },
        tradeThesis
      );

      if (result.success && result.trade) {
        // Play buy sound and triumphant alert
        soundService.playBuySound();

        // Play triumphant fanfare after cash register sound
        setTimeout(() => {
          soundService.playSuccessSound();
        }, 200);

        // Trigger confetti celebration
        const confetti = (await import('canvas-confetti')).default;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });

        // Update portfolio with new trade
        const updatedPortfolio = await realTradingService.processBuyTrade(
          userId,
          portfolio,
          result.trade,
          {
            marketId: selectedMarket.id,
            marketQuestion: selectedMarket.question,
            marketSlug: selectedMarket.slug,
            eventImage: event?.image,
          },
          tradeThesis
        );

        // Add P&L snapshot to portfolio history
        const portfolioWithSnapshot = addPnLSnapshot(updatedPortfolio);
        setPortfolio(portfolioWithSnapshot);

        setTradeSuccessMessage(
          `✅ Bought ${result.trade.sizeMatched.toFixed(2)} shares of ${tradeSide} for $${amount.toFixed(2)}!`
        );
        setShowTradeSuccess(true);
        setTimeout(() => setShowTradeSuccess(false), 5000);

        setTradeAmount('');
        setTradeThesis('');
        setSelectedMarket(null);
      } else {
        soundService.playErrorSound();
        alert(`❌ Buy failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('❌ Buy error:', error);
      alert(`❌ Error executing buy: ${error.message}`);
    } finally {
      setTradingInProgress(false);
    }
  };

  const executeSell = async (positionId: string, percentage: number = 100) => {
    if (!userId) return;

    const position = (portfolio.positions || []).find(p => p.id === positionId);
    if (!position) {
      alert('Position not found');
      return;
    }

    setTradingInProgress(true);
    setSellingPositionId(positionId);

    try {
      console.log('🔴 Executing real SELL order for position:', position.marketQuestion);

      // Get token ID - use stored tokenId first (most reliable), then try alternatives
      let tokenId: string | null = position.tokenId || null;
      console.log('📋 Position tokenId from storage:', tokenId);

      // If not stored, try to get from loaded event markets
      if (!tokenId) {
        console.log('⚠️ No tokenId in position, trying from loaded event...');
        const market = event?.markets.find(m => m.id === position.marketId);
        if (market) {
          tokenId = getTokenId(market, position.side);
        }
      }

      // If still not found and we have a market slug, fetch from API
      if (!tokenId && position.marketSlug) {
        console.log('🔍 Fetching token ID from API using market slug:', position.marketSlug);
        const { getTokenIdForMarket } = await import('@/lib/tradingApi');
        tokenId = await getTokenIdForMarket(position.marketSlug, position.side);
      }

      if (!tokenId) {
        alert('Token ID not found. Unable to execute sell order. Please contact support.');
        setSellingPositionId(null);
        setTradingInProgress(false);
        return;
      }

      console.log('✅ Token ID found:', tokenId);

      const currentPrice = currentPrices[position.id] || position.avgPrice;

      const result = await realTradingService.executeSell(
        tokenId,
        position.orderID, // Use the original buy order ID for selling
        percentage,
        {
          marketId: position.marketId,
          marketQuestion: position.marketQuestion,
          side: position.side,
        }
      );

      if (result.success && result.trade) {
        // Play sell sound
        soundService.playSellSound();

        // Update portfolio with sell trade
        const updatedPortfolio = await realTradingService.processSellTrade(
          userId,
          portfolio,
          result.trade,
          currentPrice,
          positionId
        );

        // Add P&L snapshot to portfolio history
        const portfolioWithSnapshot = addPnLSnapshot(updatedPortfolio);
        setPortfolio(portfolioWithSnapshot);

        const soldShares = result.trade.sizeMatched;
        const soldValue = soldShares * currentPrice;
        const pnl = soldValue - (position.cost / position.shares * soldShares);

        // Show toast notification
        setToastMessage(
          `Sold ${soldShares.toFixed(2)} shares for $${soldValue.toFixed(2)} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`
        );
        setToastType('success');

        // Clear selling state
        setSellingPositionId(null);
      } else {
        soundService.playErrorSound();
        alert(`❌ Sell failed: ${result.error}`);
        // Clear selling state on error
        setSellingPositionId(null);
      }
    } catch (error: any) {
      console.error('❌ Sell error:', error);
      alert(`❌ Error executing sell: ${error.message}`);
      // Clear selling state on error
      setSellingPositionId(null);
    } finally {
      setTradingInProgress(false);
    }
  };

  const handleClosePosition = async (portfolioPosition: { id: string; question: string; outcome: 'yes' | 'no'; entryPrice: number; shares: number; marketSlug: string; currentPrice?: number }) => {
    setSellingPositionId(portfolioPosition.id);
    await executeSell(portfolioPosition.id, 100);
  };

  const handleUpdateThesis = async (positionId: string, thesis: string) => {
    const updatedPortfolio = {
      ...portfolio,
      positions: (portfolio.positions || []).map(p => p.id === positionId ? { ...p, thesis } : p),
    };
    setPortfolio(updatedPortfolio);

    // Persist to Firestore
    if (userId) {
      await portfolioService.savePortfolio(userId, updatedPortfolio);
    }
  };

  const handleUpdatePolymarketUrl = async (positionId: string, url: string) => {
    const updatedPortfolio = {
      ...portfolio,
      positions: (portfolio.positions || []).map(p => p.id === positionId ? { ...p, polymarketUrl: url } : p),
    };
    setPortfolio(updatedPortfolio);

    // Persist to Firestore
    if (userId) {
      try {
        await portfolioService.savePortfolio(userId, updatedPortfolio);
        console.log('✅ Polymarket URL saved to Firestore');
        setToastMessage('Polymarket link saved!');
        setToastType('success');
      } catch (error: any) {
        console.error('❌ Failed to save Polymarket URL:', error);
        setToastMessage('Failed to save link: ' + error.message);
        setToastType('error');
      }
    }
  };

  const handleUpdateExitNotes = async (positionId: string, notes: string) => {
    const updatedPortfolio = {
      ...portfolio,
      positions: (portfolio.positions || []).map(p => p.id === positionId ? { ...p, exitNotes: notes } : p),
    };
    setPortfolio(updatedPortfolio);

    // Persist to Firestore
    if (userId) {
      await portfolioService.savePortfolio(userId, updatedPortfolio);
    }
  };

  // Convert positions for Portfolio component
  const convertedPositions = (portfolio.positions || []).map(pos => ({
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
    exitNotes: pos.exitNotes,
  }));

  if (currentView === 'portfolio') {
    return (
      <Portfolio
        positions={convertedPositions}
        balance={portfolio.balance}
        initialBalance={portfolio.initialBalance}
        onClose={handleClosePosition}
        onUpdateThesis={handleUpdateThesis}
        onUpdatePolymarketUrl={handleUpdatePolymarketUrl}
        onUpdateExitNotes={handleUpdateExitNotes}
        isProcessing={tradingInProgress}
        sellingPositionId={sellingPositionId}
        pnlHistory={(portfolio.pnlHistory || []).map(snap => ({
          timestamp: snap.timestamp,
          pnl: snap.totalPnL,
        }))}
      />
    );
  }

  // Calculate PnL
  const pnlData = realTradingService.calculatePnL(portfolio.positions);

  return (
    <div className={styles.container}>

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Search Section */}
      <div className={styles.searchSection}>
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <div className={styles.searchInputWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search markets (e.g., Will anyone be charged over Daycare Fraud)"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            <button type="submit" className={styles.searchButton} disabled={loading}>
              {loading ? (
                <svg className={styles.spinner} width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite" />
                  </circle>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              )}
            </button>

            {/* Search suggestions dropdown */}
            {showSuggestions && searchResults.length > 0 && (
              <div className={styles.searchSuggestions}>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className={styles.suggestionItem}
                    onClick={() => handleSelectEvent(result)}
                  >
                    {result.image && (
                      <img
                        src={result.image}
                        alt={result.title}
                        className={styles.suggestionImage}
                      />
                    )}
                    <div className={styles.suggestionContent}>
                      <div className={styles.suggestionTitle}>{result.title}</div>
                      <div className={styles.suggestionMeta}>
                        {result.markets?.length || 0} market{result.markets?.length !== 1 ? 's' : ''} •
                        ${(result.volume || 0).toLocaleString()} volume
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
        {!event && (
          <div className={styles.searchHint}>
            Search for any prediction market by typing keywords or questions
          </div>
        )}
      </div>

      {/* Portfolio Stats */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total P&L</div>
          <div className={`${styles.statValue} ${pnlData.total >= 0 ? styles.positive : styles.negative}`}>
            {pnlData.total >= 0 ? '+' : ''}${pnlData.total.toFixed(2)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Realized P&L</div>
          <div className={`${styles.statValue} ${pnlData.realized >= 0 ? styles.positive : styles.negative}`}>
            {pnlData.realized >= 0 ? '+' : ''}${pnlData.realized.toFixed(2)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Unrealized P&L</div>
          <div className={`${styles.statValue} ${pnlData.unrealized >= 0 ? styles.positive : styles.negative}`}>
            {pnlData.unrealized >= 0 ? '+' : ''}${pnlData.unrealized.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Leaderboard - only show when no event is selected */}
      {!event && <Leaderboard timeWindow="1d" limit={10} />}

      {/* Event Display */}
      {event && (
        <>
          <div className={styles.eventSection}>
            <div className={styles.eventHeader}>
              {event.image && <img src={event.image} alt={event.title} className={styles.eventImage} />}
              <div className={styles.eventInfo}>
                <h2 className={styles.eventTitle}>{event.title}</h2>
                <p className={styles.eventDescription}>{event.description}</p>
              </div>
            </div>
          </div>

          <div className={styles.marketsGrid}>
            {event.markets.map((market) => {
              const yesPrice = getBestPrice(market, 'YES');
              const noPrice = getBestPrice(market, 'NO');

              return (
                <div key={market.id} className={styles.marketCard}>
                  <div className={styles.marketQuestion}>{market.question}</div>

                  <div className={styles.outcomesRow}>
                    <div className={`${styles.outcomeCard} ${styles.yes}`}>
                      <div className={styles.outcomeHeader}>
                        <div className={styles.outcomeLabel}>YES</div>
                        <div className={styles.outcomePrice}>{Math.round(yesPrice * 100)}¢</div>
                      </div>
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
                        <div className={styles.outcomePrice}>{Math.round(noPrice * 100)}¢</div>
                      </div>
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
        <div className={styles.tradeModal} onClick={() => !tradingInProgress && setSelectedMarket(null)}>
          <div className={styles.tradeModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setSelectedMarket(null)} disabled={tradingInProgress}>✕</button>

            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Buy {tradeSide}</h3>
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
                  disabled={tradingInProgress}
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
                  disabled={tradingInProgress}
                />
              </div>

              <div className={styles.tradeActions}>
                <button
                  className={`${styles.actionButton} ${tradeSide === 'YES' ? styles.buyYes : styles.buyNo}`}
                  onClick={executeBuy}
                  disabled={!tradeAmount || parseFloat(tradeAmount) <= 0 || tradingInProgress}
                >
                  {tradingInProgress ? 'Processing...' : `Buy ${tradeSide}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showTradeSuccess && (
        <div className={styles.successToast}>
          <div className={styles.toastIcon}>✓</div>
          <div className={styles.toastMessage}>{tradeSuccessMessage}</div>
        </div>
      )}
    </div>
  );
}
