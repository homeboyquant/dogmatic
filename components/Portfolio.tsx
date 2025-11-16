import { useState, useEffect } from 'react';
import { Position } from '@/types/trading';
import TradingTimer from './TradingTimer';
import styles from './Portfolio.module.css';

interface PortfolioPosition {
  id: string;
  question: string;
  outcome: 'yes' | 'no';
  entryPrice: number;
  shares: number;
  marketSlug: string;
  thesis?: string;
  eventImage?: string;
  closed?: boolean;
  exitPrice?: number;
  polymarketUrl?: string;
  exitNotes?: string;
}

interface PortfolioProps {
  positions: PortfolioPosition[];
  balance: number;
  onClose: (position: PortfolioPosition) => void;
  onUpdateThesis: (positionId: string, thesis: string) => void;
  onUpdatePolymarketUrl: (positionId: string, url: string) => void;
  onUpdateExitNotes: (positionId: string, notes: string) => void;
}

export default function Portfolio({ positions, balance, onClose, onUpdateThesis, onUpdatePolymarketUrl, onUpdateExitNotes }: PortfolioProps) {
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [editingThesisId, setEditingThesisId] = useState<string | null>(null);
  const [editThesisValue, setEditThesisValue] = useState('');
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editUrlValue, setEditUrlValue] = useState('');
  const [editingExitNotesId, setEditingExitNotesId] = useState<string | null>(null);
  const [editExitNotesValue, setEditExitNotesValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  // Fetch prices function
  const fetchPrices = async () => {
    if (positions.length === 0) return;

    setIsLoading(true);
    console.log('🔄 Fetching prices for', positions.length, 'positions at', new Date().toLocaleTimeString());

    try {
      // Use proxy API to avoid CORS issues
      const response = await fetch('/api/fetch-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });

      const data = await response.json();

      if (data.success && data.prices) {
        setCurrentPrices(data.prices);

        // Log individual price updates
        positions.forEach(position => {
          const newPrice = data.prices[position.id];
          if (newPrice !== position.entryPrice) {
            console.log(`✅ ${position.question.substring(0, 30)}... ${position.outcome.toUpperCase()}: $${newPrice.toFixed(3)}`);
          }
        });
      } else {
        console.error('❌ Failed to fetch prices:', data.error);
        // Fallback to entry prices
        const fallbackPrices: Record<string, number> = {};
        positions.forEach(pos => {
          fallbackPrices[pos.id] = pos.entryPrice;
        });
        setCurrentPrices(fallbackPrices);
      }
    } catch (error) {
      console.error('❌ Error fetching prices:', error);
      // Fallback to entry prices
      const fallbackPrices: Record<string, number> = {};
      positions.forEach(pos => {
        fallbackPrices[pos.id] = pos.entryPrice;
      });
      setCurrentPrices(fallbackPrices);
    }

    setLastUpdate(new Date());
    setIsLoading(false);
    console.log('✅ Price update complete at', new Date().toLocaleTimeString());
  };

  // Initial fetch and interval
  useEffect(() => {
    if (positions.length > 0) {
      console.log('📊 Portfolio mounted with', positions.length, 'positions');
      fetchPrices();

      // Refresh every 30 seconds
      const interval = setInterval(() => {
        console.log('⏰ Auto-refresh triggered');
        fetchPrices();
      }, 30000);

      return () => {
        console.log('🛑 Clearing price update interval');
        clearInterval(interval);
      };
    }
  }, [positions]);

  const calculatePnL = (position: PortfolioPosition) => {
    // For closed positions, use exitPrice. For open positions, use fetched current price
    const currentPrice = position.closed && position.exitPrice
      ? position.exitPrice
      : (currentPrices[position.id] || position.entryPrice);

    const priceDiff = currentPrice - position.entryPrice;
    const pnl = priceDiff * position.shares;
    const pnlPercent = (priceDiff / position.entryPrice) * 100;

    return { pnl, pnlPercent, currentPrice };
  };

  // Filter positions based on view
  const openPositions = positions.filter(pos => !pos.closed);
  const closedPositions = positions.filter(pos => pos.closed);
  const displayPositions = showClosed ? closedPositions : openPositions;

  const totalPnL = positions.reduce((sum, pos) => {
    const { pnl } = calculatePnL(pos);
    return sum + pnl;
  }, 0);

  const realizedPnL = closedPositions.reduce((sum, pos) => {
    const { pnl } = calculatePnL(pos);
    return sum + pnl;
  }, 0);

  const totalValue = openPositions.reduce((sum, pos) => {
    const { currentPrice } = calculatePnL(pos);
    return sum + (currentPrice * pos.shares);
  }, 0);

  return (
    <div className={styles.container}>
      {/* Trading Timer */}
      <TradingTimer currentPnL={realizedPnL} />

      <div className={styles.header}>
        <h1 className={styles.title}>Portfolio</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshButton}
            onClick={fetchPrices}
            disabled={isLoading}
          >
            <svg
              className={`${styles.refreshIcon} ${isLoading ? styles.spinning : ''}`}
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
            {isLoading ? 'Updating...' : 'Refresh Prices'}
          </button>
          <div className={styles.lastUpdate}>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Cash Balance</div>
          <div className={styles.summaryValue}>${balance.toFixed(2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Positions Value</div>
          <div className={styles.summaryValue}>${totalValue.toFixed(2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total P&L</div>
          <div className={`${styles.summaryValue} ${totalPnL >= 0 ? styles.positive : styles.negative}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Realized P&L</div>
          <div className={`${styles.summaryValue} ${realizedPnL >= 0 ? styles.positive : styles.negative}`}>
            {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Portfolio</div>
          <div className={styles.summaryValue}>${(balance + totalValue).toFixed(2)}</div>
        </div>
      </div>

      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${!showClosed ? styles.active : ''}`}
          onClick={() => setShowClosed(false)}
        >
          Open Positions ({openPositions.length})
        </button>
        <button
          className={`${styles.toggleButton} ${showClosed ? styles.active : ''}`}
          onClick={() => setShowClosed(true)}
        >
          Closed Positions ({closedPositions.length})
        </button>
      </div>

      <div className={styles.positions}>
        {displayPositions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <div className={styles.emptyText}>No {showClosed ? 'closed' : 'open'} positions</div>
            <div className={styles.emptySubtext}>
              {showClosed ? 'No positions have been closed yet' : 'Start trading to build your portfolio'}
            </div>
          </div>
        ) : (
          displayPositions.map((position) => {
            const { pnl, pnlPercent, currentPrice } = calculatePnL(position);

            return (
              <div key={position.id} className={styles.positionCard}>
                <div className={styles.positionHeader}>
                  {position.eventImage && (
                    <img src={position.eventImage} alt="" className={styles.eventImage} />
                  )}
                  <div className={styles.positionHeaderContent}>
                    <div className={styles.positionQuestion}>
                      {position.question}
                    </div>
                    <div className={`${styles.positionOutcome} ${position.outcome === 'yes' ? styles.yes : styles.no}`}>
                      {position.outcome.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className={styles.positionDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Entry Price</span>
                    <span className={styles.detailValue}>${position.entryPrice.toFixed(3)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>{position.closed ? 'Sell Price' : 'Current Sell Price'}</span>
                    <span className={styles.detailValue}>${currentPrice.toFixed(3)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Shares</span>
                    <span className={styles.detailValue}>{position.shares.toFixed(2)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Cost Basis</span>
                    <span className={styles.detailValue}>${(position.entryPrice * position.shares).toFixed(2)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>{position.closed ? 'Sell Value' : 'Current Sell Value'}</span>
                    <span className={`${styles.detailValue} ${pnl >= 0 ? styles.positive : styles.negative}`}>
                      ${(currentPrice * position.shares).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className={styles.positionThesis}>
                  <div className={styles.thesisHeader}>
                    <div className={styles.thesisLabel}>Trade Thesis</div>
                    {editingThesisId !== position.id && (
                      <button
                        className={styles.editThesisButton}
                        onClick={() => {
                          setEditingThesisId(position.id);
                          setEditThesisValue(position.thesis || '');
                        }}
                      >
                        {position.thesis ? 'Edit' : 'Add'}
                      </button>
                    )}
                  </div>
                  {editingThesisId === position.id ? (
                    <div className={styles.thesisEditForm}>
                      <textarea
                        className={styles.thesisTextarea}
                        value={editThesisValue}
                        onChange={(e) => setEditThesisValue(e.target.value)}
                        placeholder="Enter your trade thesis..."
                        rows={3}
                        autoFocus
                      />
                      <div className={styles.thesisEditActions}>
                        <button
                          className={styles.saveThesisButton}
                          onClick={() => {
                            onUpdateThesis(position.id, editThesisValue);
                            setEditingThesisId(null);
                          }}
                        >
                          Save
                        </button>
                        <button
                          className={styles.cancelThesisButton}
                          onClick={() => setEditingThesisId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.thesisText}>
                      {position.thesis || 'No thesis added yet'}
                    </div>
                  )}
                </div>

                {position.closed && (
                  <div className={styles.exitNotesSection}>
                    <div className={styles.thesisHeader}>
                      <div className={styles.thesisLabel}>EXIT NOTES</div>
                      <button
                        className={styles.editThesisButton}
                        onClick={() => {
                          setEditingExitNotesId(position.id);
                          setEditExitNotesValue(position.exitNotes || '');
                        }}
                      >
                        {position.exitNotes ? 'Edit' : 'Add'}
                      </button>
                    </div>
                    {editingExitNotesId === position.id ? (
                      <div className={styles.thesisEditForm}>
                        <textarea
                          className={styles.thesisTextarea}
                          value={editExitNotesValue}
                          onChange={(e) => setEditExitNotesValue(e.target.value)}
                          placeholder="Why did you exit this position?"
                          rows={3}
                          autoFocus
                        />
                        <div className={styles.thesisEditActions}>
                          <button
                            className={styles.saveThesisButton}
                            onClick={() => {
                              onUpdateExitNotes(position.id, editExitNotesValue);
                              setEditingExitNotesId(null);
                            }}
                          >
                            Save
                          </button>
                          <button
                            className={styles.cancelThesisButton}
                            onClick={() => setEditingExitNotesId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.thesisText}>
                        {position.exitNotes || 'No exit notes added yet'}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.positionPnL}>
                  <div className={`${styles.pnlValue} ${pnl >= 0 ? styles.positive : styles.negative}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                  </div>
                  <div className={styles.positionActions}>
                    {position.polymarketUrl ? (
                      <a
                        href={position.polymarketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.viewOnPolymarketButton}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        View on Polymarket
                      </a>
                    ) : !position.closed && (
                      <button
                        className={styles.addPolymarketLinkButton}
                        onClick={() => {
                          setEditingUrlId(position.id);
                          setEditUrlValue('');
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        Add Polymarket Link
                      </button>
                    )}
                    {!position.closed && (
                      <button
                        className={styles.closeButton}
                        onClick={() => onClose(position)}
                      >
                        Close Position
                      </button>
                    )}
                  </div>
                </div>

                {editingUrlId === position.id && (
                  <div className={styles.linkEditModal}>
                    <div className={styles.linkEditHeader}>
                      <h4>Add Polymarket Link</h4>
                      <button
                        className={styles.closeModalButton}
                        onClick={() => {
                          setEditingUrlId(null);
                          setEditUrlValue('');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="url"
                      className={styles.linkInput}
                      value={editUrlValue}
                      onChange={(e) => setEditUrlValue(e.target.value)}
                      placeholder="https://polymarket.com/event/..."
                      autoFocus
                    />
                    <div className={styles.linkEditActions}>
                      <button
                        className={styles.saveLinkButton}
                        onClick={() => {
                          if (editUrlValue.trim()) {
                            onUpdatePolymarketUrl(position.id, editUrlValue.trim());
                          }
                          setEditingUrlId(null);
                          setEditUrlValue('');
                        }}
                      >
                        Save Link
                      </button>
                      <button
                        className={styles.cancelLinkButton}
                        onClick={() => {
                          setEditingUrlId(null);
                          setEditUrlValue('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
