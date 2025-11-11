import { useState, useEffect } from 'react';
import { Event } from '@/types/polymarket';
import styles from './MarketsGrid.module.css';

interface MarketsGridProps {
  onSelectEvent: (event: Event) => void;
  selectedTag?: string;
  sortBy?: 'volume' | 'new' | 'ending';
}

export default function MarketsGrid({ onSelectEvent, selectedTag, sortBy = 'volume' }: MarketsGridProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      console.log('📊 Fetching events for grid...');
      try {
        const params = new URLSearchParams({
          limit: '100',
          closed: 'false',
          order: sortBy === 'new' ? 'createdAt' : 'volume24hr',
          ascending: 'false',
        });

        if (selectedTag) {
          params.append('tag_id', selectedTag);
        }

        const response = await fetch(`/api/events?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Events data received:', data.length);

        if (Array.isArray(data)) {
          // Filter for active, non-closed, non-archived events
          let filtered = data.filter((event: Event) =>
            !event.archived &&
            !event.closed &&
            event.active
          );

          // Sort based on selected criteria
          if (sortBy === 'volume') {
            filtered.sort((a, b) => b.volume24hr - a.volume24hr);
          } else if (sortBy === 'ending') {
            filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
          } else {
            filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }

          filtered = filtered.slice(0, 24); // Show 24 events

          console.log('✅ Filtered events:', filtered.length);
          setEvents(filtered);
        }
      } catch (error) {
        console.error('❌ Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [selectedTag, sortBy]);

  const formatVolume = (volume: string) => {
    const vol = parseFloat(volume);
    if (isNaN(vol)) return '$0';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>⋯</div>
        <p>Loading markets...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No active markets found</p>
      </div>
    );
  }

  const getPrimaryOutcome = (event: Event) => {
    if (!event.markets || event.markets.length === 0) return null;
    const primaryMarket = event.markets[0];
    if (!primaryMarket.outcomePrices || primaryMarket.outcomePrices.length === 0) return null;

    const yesPrice = parseFloat(primaryMarket.outcomePrices[0]);
    return isNaN(yesPrice) ? null : Math.round(yesPrice * 100);
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {events.map((event) => {
          const probability = getPrimaryOutcome(event);
          const marketCount = event.markets?.length || 0;

          return (
            <div
              key={event.id}
              className={styles.card}
              onClick={() => onSelectEvent(event)}
            >
              {event.image && (
                <div className={styles.imageWrapper}>
                  <img src={event.image} alt={event.title} className={styles.image} />
                </div>
              )}
              <div className={styles.content}>
                <h3 className={styles.title}>{event.title}</h3>

                <div className={styles.stats}>
                  {probability !== null && (
                    <div className={styles.probability}>
                      <span className={styles.probabilityValue}>{probability}%</span>
                      <span className={styles.probabilityLabel}>chance</span>
                    </div>
                  )}
                  <div className={styles.volume}>
                    <span className={styles.volumeValue}>{formatVolume(event.volume24hr.toString())}</span>
                    <span className={styles.volumeLabel}>24h vol</span>
                  </div>
                </div>

                {marketCount > 1 && (
                  <div className={styles.marketCount}>
                    {marketCount} markets
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
