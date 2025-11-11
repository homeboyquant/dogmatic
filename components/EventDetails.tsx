import { Event } from '@/types/polymarket';
import styles from './EventDetails.module.css';

interface EventDetailsProps {
  event: Event;
  onClose: () => void;
}

export default function EventDetails({ event, onClose }: EventDetailsProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatVolume = (volume: number) => {
    if (isNaN(volume)) return 'N/A';
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const marketCount = event.markets?.length || 0;
  const isGroupEvent = marketCount > 1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{event.title}</h2>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>
      </div>

      {event.image && (
        <div className={styles.eventImage}>
          <img src={event.image} alt={event.title} />
        </div>
      )}

      {event.description && (
        <p className={styles.description}>{event.description}</p>
      )}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>24h Volume</div>
          <div className={styles.statValue}>{formatVolume(event.volume24hr)}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Volume</div>
          <div className={styles.statValue}>{formatVolume(event.volume)}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Liquidity</div>
          <div className={styles.statValue}>{formatVolume(event.liquidity)}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Status</div>
          <div className={styles.statValue}>
            {event.active ? (
              <span className={styles.statusActive}>Active</span>
            ) : event.closed ? (
              <span className={styles.statusClosed}>Closed</span>
            ) : (
              <span className={styles.statusInactive}>Inactive</span>
            )}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>End Date</div>
          <div className={styles.statValue}>{formatDate(event.endDate)}</div>
        </div>

        {isGroupEvent && (
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Markets</div>
            <div className={styles.statValue}>{marketCount}</div>
          </div>
        )}
      </div>

      {event.markets && event.markets.length > 0 && (
        <div className={styles.outcomesSection}>
          <h3 className={styles.sectionTitle}>
            {isGroupEvent ? 'Markets' : 'Outcomes'}
          </h3>
          <div className={styles.outcomes}>
            {event.markets.map((market, marketIndex) => {
              if (isGroupEvent) {
                // For group events, show each market
                const price = market.outcomePrices?.[0];
                const probability = price ? (parseFloat(price) * 100).toFixed(1) : '—';

                return (
                  <div key={market.id} className={styles.outcome}>
                    <div className={styles.outcomeHeader}>
                      <span className={styles.outcomeName}>{market.question}</span>
                      <span className={styles.outcomeProbability}>{probability}%</span>
                    </div>
                    {price && (
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${probability}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              } else {
                // For single market events, show outcomes
                const primaryMarket = event.markets[0];
                return primaryMarket.outcomes?.map((outcome, index) => {
                  const price = primaryMarket.outcomePrices?.[index];
                  const probability = price ? (parseFloat(price) * 100).toFixed(1) : '—';

                  return (
                    <div key={index} className={styles.outcome}>
                      <div className={styles.outcomeHeader}>
                        <span className={styles.outcomeName}>{outcome}</span>
                        <span className={styles.outcomeProbability}>{probability}%</span>
                      </div>
                      {price && (
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${probability}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                });
              }
            })}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <a
          href={`https://polymarket.com/event/${event.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.viewButton}
        >
          View on Polymarket →
        </a>
      </div>
    </div>
  );
}
