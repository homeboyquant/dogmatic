import { useState, useEffect } from 'react';
import PnLChart from './PnLChart';
import styles from './Portfolio.module.css';

interface Trade {
  id: string;
  taker_order_id: string;
  market: string;
  asset_id: string;
  side: string;
  size: string;
  price: string;
  match_time: string;
  marketTitle?: string;
  outcome?: string;
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
  marketTitle: string;
  status: 'active' | 'closed';
  buyTrades: Trade[];
  sellTrades: Trade[];
  curPrice?: number;
  cashPnl?: number;
  percentPnl?: number;
}

interface PortfolioData {
  orders: any[];
  activePositions: Position[];
  closedPositions: Position[];
  recentTrades: Trade[];
  stats: {
    totalActive: number;
    totalClosed: number;
    totalTrades: number;
  };
  timestamp: string;
}

interface ApiResponse {
  status?: string;
  response?: {
    success?: boolean;
    detail?: string;
    error?: string;
  };
}

export default function CLOBPortfolio() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<'open' | 'closed' | 'activity'>('open');
  const [sellLoading, setSellLoading] = useState<string | null>(null);
  const [sellMessage, setSellMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/clob-trades');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
      setLastUpdate(new Date());
      console.log('✅ Portfolio data loaded:', result.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('❌ Failed to fetch portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      console.log('🔄 Fetching USDC balance...');
      const response = await fetch('/api/wallet-balance');
      const result = await response.json();
      if (result.success) {
        setUsdcBalance(result.balance);
      }
    } catch (error) {
      console.error('Failed to fetch USDC balance:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBalance();
    // Refresh every 5 seconds (like homeboy_monitor)
    const interval = setInterval(fetchData, 5000);
    const balanceInterval = setInterval(fetchBalance, 30000);
    return () => {
      clearInterval(interval);
      clearInterval(balanceInterval);
    };
  }, []);

  const calculatePnL = (pos: Position) => {
    // For closed positions, calculate realized P&L
    if (pos.status === 'closed' && pos.totalSold > 0) {
      return (pos.avgSellPrice - pos.avgBuyPrice) * pos.totalSold;
    }
    // For active positions with partial sells, calculate partial realized P&L
    if (pos.totalSold > 0) {
      return (pos.avgSellPrice - pos.avgBuyPrice) * pos.totalSold;
    }
    return null;
  };

  const handleSellClick = async (position: Position) => {
    const positionKey = `${position.market}-${position.asset_id}`;
    setSellLoading(positionKey);
    setSellMessage(null);

    try {
      // Get order_id from buyTrades if available
      const order_id = position.buyTrades && position.buyTrades.length > 0
        ? position.buyTrades[0].taker_order_id
        : undefined;

      console.log('🔴 SELL BUTTON CLICKED');
      console.log('📊 Position:', position.marketTitle);
      console.log('🎯 Token ID:', position.asset_id);
      console.log('🔑 Order ID:', order_id || 'NOT FOUND');
      console.log('📦 BuyTrades count:', position.buyTrades?.length || 0);
      if (position.buyTrades && position.buyTrades.length > 0) {
        console.log('📋 All buyTrades:', position.buyTrades);
      }

      // Call our local API which will use order_id if provided, or fetch it if not
      const sellResponse = await fetch('/api/sell-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: position.asset_id,
          sell_percentage: 100,
          order_id: order_id
        }),
      });

      const sellData = await sellResponse.json();

      console.log('✅ Sell response:', sellData);

      // Check for success
      if (sellData && sellData.success) {
        const sizeMatched = sellData.size_matched ? parseFloat(sellData.size_matched).toFixed(2) : position.netSize.toFixed(2);
        setSellMessage({
          type: 'success',
          text: `Successfully sold ${sizeMatched} shares of ${position.marketTitle}`
        });
        setTimeout(() => fetchData(), 2000);
      } else {
        // Only show error if there's actually an error (not empty errorMsg)
        const errorDetail = sellData?.error && sellData.error !== ''
          ? sellData.error
          : sellData?.message || 'Unknown error';
        setSellMessage({
          type: 'error',
          text: `Failed to sell: ${errorDetail}`
        });
      }
    } catch (error) {
      setSellMessage({
        type: 'error',
        text: `Error selling position: ${error}`
      });
    } finally {
      setSellLoading(null);
      setTimeout(() => setSellMessage(null), 10000);
    }
  };

  // Calculate total unrealized P&L from active positions using the cashPnl already calculated by the API
  const unrealizedPnL = data?.activePositions.reduce((sum, pos) => {
    // Use the cashPnl from the API which is already calculated as (curPrice - avgBuyPrice) * netSize
    return sum + (pos.cashPnl || 0);
  }, 0) || 0;

  // Calculate realized P&L from all positions (both active and closed)
  // Realized P&L = sum of (avgSellPrice - avgBuyPrice) * totalSold for all positions
  const realizedPnL = (() => {
    let total = 0;

    // Add realized P&L from closed positions
    if (data?.closedPositions) {
      for (const pos of data.closedPositions) {
        const pnl = calculatePnL(pos);
        if (pnl !== null) {
          total += pnl;
        }
      }
    }

    // Add realized P&L from active positions with partial sells
    if (data?.activePositions) {
      for (const pos of data.activePositions) {
        if (pos.totalSold > 0) {
          const pnl = calculatePnL(pos);
          if (pnl !== null) {
            total += pnl;
          }
        }
      }
    }

    return total;
  })();

  // Calculate total P&L = unrealized + realized
  const totalPnL = unrealizedPnL + realizedPnL;

  const displayPositions = activeView === 'closed'
    ? data?.closedPositions || []
    : activeView === 'open'
      ? data?.activePositions || []
      : [];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 className={styles.title}>Portfolio</h1>
            {usdcBalance !== null && (
              <div style={{
                padding: '8px 16px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: 'rgb(16, 185, 129)',
                  borderRadius: '50%'
                }}></div>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'rgb(16, 185, 129)',
                  fontFamily: 'monospace'
                }}>
                  ${usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: '12px', color: 'rgb(16, 185, 129)', opacity: 0.8 }}>USDC</span>
              </div>
            )}
          </div>
          {data && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {data.stats.totalActive} active • {data.stats.totalClosed} closed • {data.stats.totalTrades} total trades
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshButton}
            onClick={() => {
              fetchData();
              fetchBalance();
            }}
            disabled={loading}
          >
            <svg
              className={`${styles.refreshIcon} ${loading ? styles.spinning : ''}`}
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 100 16 7.938 7.938 0 005.308-2.036l-1.416-1.414A5.98 5.98 0 018 14a6 6 0 116-6h-2l3-3 3 3h-2a8 8 0 01-2.35 5.65z"
                fill="currentColor"
              />
            </svg>
            {loading ? 'Updating...' : 'Refresh'}
          </button>
          {lastUpdate && (
            <div className={styles.lastUpdate}>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Sell Message */}
      {sellMessage && (
        <div className={`${styles.summary} ${sellMessage.type === 'success' ? styles.successMessage : styles.errorMessage}`}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{sellMessage.text}</div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total P&L</div>
          <div className={`${styles.summaryValue} ${totalPnL >= 0 ? styles.positive : styles.negative}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Unrealized P&L</div>
          <div className={`${styles.summaryValue} ${unrealizedPnL >= 0 ? styles.positive : styles.negative}`}>
            {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Realized P&L</div>
          <div className={`${styles.summaryValue} ${realizedPnL >= 0 ? styles.positive : styles.negative}`}>
            {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}
          </div>
        </div>
      </div>

      {/* View Toggles */}
      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${activeView === 'open' ? styles.active : ''}`}
          onClick={() => setActiveView('open')}
        >
          Open Positions ({data?.activePositions.length || 0})
        </button>
        <button
          className={`${styles.toggleButton} ${activeView === 'closed' ? styles.active : ''}`}
          onClick={() => setActiveView('closed')}
        >
          Closed Positions ({data?.closedPositions.length || 0})
        </button>
        <button
          className={`${styles.toggleButton} ${activeView === 'activity' ? styles.active : ''}`}
          onClick={() => setActiveView('activity')}
        >
          Activity ({data?.recentTrades.length || 0})
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className={styles.empty}>
          <div className={styles.emptyText}>Error: {error}</div>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className={styles.empty}>
          <div className={styles.emptyText}>Loading portfolio...</div>
        </div>
      )}

      {/* Activity/Trade History */}
      {activeView === 'activity' ? (
        <div className={styles.positions}>
          {!data?.recentTrades || data.recentTrades.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div className={styles.emptyText}>No recent trades</div>
            </div>
          ) : (
            data.recentTrades.map((trade) => {
              const tradeTime = new Date(parseInt(trade.match_time) * 1000);
              const isBuy = trade.side === 'BUY';

              return (
                <div key={trade.id} className={styles.positionCard}>
                  <div className={styles.positionHeader}>
                    <div className={styles.positionHeaderContent}>
                      <div className={styles.positionQuestion}>
                        {trade.marketTitle || 'Unknown Market'}
                      </div>
                      <div className={`${styles.positionOutcome} ${isBuy ? styles.yes : styles.no}`}>
                        {trade.side} {trade.outcome?.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className={styles.positionDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Size</span>
                      <span className={styles.detailValue}>{parseFloat(trade.size).toFixed(2)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Price</span>
                      <span className={styles.detailValue}>${parseFloat(trade.price).toFixed(3)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Total Value</span>
                      <span className={styles.detailValue}>
                        ${(parseFloat(trade.size) * parseFloat(trade.price)).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Time</span>
                      <span className={styles.detailValue}>
                        {tradeTime.toLocaleDateString()} {tradeTime.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className={styles.positionPnL}>
                    <div className={`${styles.pnlValue} ${isBuy ? styles.positive : styles.negative}`}>
                      {isBuy ? '📈 BUY' : '📉 SELL'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Positions List */
        <div className={styles.positions}>
          {displayPositions.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <div className={styles.emptyText}>
                No {activeView === 'closed' ? 'closed' : 'open'} positions
              </div>
            </div>
          ) : (
            displayPositions.map((position) => {
              const positionKey = `${position.market}-${position.asset_id}`;
              const costBasis = position.avgBuyPrice * position.netSize;
              const pnl = calculatePnL(position);

              return (
                <div key={positionKey} className={styles.positionCard}>
                  <div className={styles.positionHeader}>
                    <div className={styles.positionHeaderContent}>
                      <div className={styles.positionQuestion}>
                        {position.marketTitle}
                      </div>
                      <div className={`${styles.positionOutcome} ${position.outcome.toLowerCase() === 'yes' ? styles.yes : styles.no}`}>
                        {position.outcome.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className={styles.positionDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Position Size</span>
                      <span className={styles.detailValue}>{position.netSize.toFixed(2)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Avg Buy Price</span>
                      <span className={styles.detailValue}>${position.avgBuyPrice.toFixed(3)}</span>
                    </div>
                    {position.curPrice !== undefined && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Current Price</span>
                        <span className={styles.detailValue}>${position.curPrice.toFixed(3)}</span>
                      </div>
                    )}
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Cost Basis</span>
                      <span className={styles.detailValue}>${costBasis.toFixed(2)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Total Bought</span>
                      <span className={styles.detailValue}>{position.totalBought.toFixed(2)}</span>
                    </div>
                    {position.totalSold > 0 && (
                      <>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Total Sold</span>
                          <span className={styles.detailValue}>{position.totalSold.toFixed(2)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Avg Sell Price</span>
                          <span className={styles.detailValue}>${position.avgSellPrice.toFixed(3)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* P&L Display - Always shown for both active and closed positions */}
                  {position.status === 'active' ? (
                    <div className={styles.positionPnL}>
                      {(() => {
                        // Use fetched P&L data if available, otherwise calculate with fallback
                        const currentPrice = position.curPrice || position.avgBuyPrice;
                        const pnlValue = position.cashPnl !== undefined ? position.cashPnl : (currentPrice - position.avgBuyPrice) * position.netSize;
                        const pnlPercent = position.percentPnl !== undefined ? position.percentPnl : (position.avgBuyPrice > 0 ? ((currentPrice - position.avgBuyPrice) / position.avgBuyPrice) * 100 : 0);

                        return (
                          <div className={`${styles.pnlValue} ${pnlValue >= 0 ? styles.positive : styles.negative}`}>
                            {pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                          </div>
                        );
                      })()}
                    </div>
                  ) : pnl !== null ? (
                    // Closed position P&L
                    <div className={styles.positionPnL}>
                      <div className={`${styles.pnlValue} ${pnl >= 0 ? styles.positive : styles.negative}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </div>
                    </div>
                  ) : null}

                  {position.status === 'active' && (
                    <div className={styles.positionActions}>
                      <button
                        className={styles.sellButton}
                        onClick={() => handleSellClick(position)}
                        disabled={sellLoading === positionKey}
                      >
                        {sellLoading === positionKey ? (
                          <>
                            <span className={styles.buttonSpinner}></span>
                            Selling...
                          </>
                        ) : (
                          <>🚀 Sell Position</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
