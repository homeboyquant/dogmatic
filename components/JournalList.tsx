import { useState, useEffect } from 'react';
import { JournalEntry } from '@/types/journal';
import { StorageService } from '@/lib/storage';
import styles from './JournalList.module.css';

interface JournalListProps {
  onEditEntry: (id: string) => void;
}

export default function JournalList({ onEditEntry }: JournalListProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = () => {
    const allEntries = StorageService.getEntries();
    setEntries(allEntries);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      StorageService.deleteEntry(id);
      loadEntries();
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesFilter = filter === 'all' || entry.status === filter;
    const matchesSearch = !searchQuery ||
      entry.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.thesis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.edge.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `${(price * 100).toFixed(1)}¢`;
  };

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📓</div>
        <h2>No journal entries yet</h2>
        <p>Start tracking your Polymarket trades to identify your edge and improve your decision-making</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${filter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`${styles.filterButton} ${filter === 'open' ? styles.filterActive : ''}`}
            onClick={() => setFilter('open')}
          >
            Open
          </button>
          <button
            className={`${styles.filterButton} ${filter === 'closed' ? styles.filterActive : ''}`}
            onClick={() => setFilter('closed')}
          >
            Closed
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {filteredEntries.map(entry => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.entryHeader}>
              <div className={styles.eventInfo}>
                {entry.eventImage && (
                  <img src={entry.eventImage} alt="" className={styles.eventImage} />
                )}
                <div>
                  <h3 className={styles.eventTitle}>{entry.eventTitle}</h3>
                  <p className={styles.marketQuestion}>{entry.marketQuestion}</p>
                </div>
              </div>
              <div className={styles.statusBadge} data-status={entry.status}>
                {entry.status}
              </div>
            </div>

            <div className={styles.tradeInfo}>
              <div className={styles.tradeDetail}>
                <span className={styles.label}>Position</span>
                <span className={`${styles.position} ${styles[entry.position]}`}>
                  {entry.position.toUpperCase()}
                </span>
              </div>
              <div className={styles.tradeDetail}>
                <span className={styles.label}>Entry</span>
                <span className={styles.value}>{formatPrice(entry.entryPrice)}</span>
              </div>
              <div className={styles.tradeDetail}>
                <span className={styles.label}>Size</span>
                <span className={styles.value}>${entry.size}</span>
              </div>
              <div className={styles.tradeDetail}>
                <span className={styles.label}>Confidence</span>
                <span className={styles.value}>{entry.confidence}/10</span>
              </div>
              {entry.status === 'closed' && entry.profitLoss !== undefined && (
                <div className={styles.tradeDetail}>
                  <span className={styles.label}>P&L</span>
                  <span
                    className={styles.profitLoss}
                    data-outcome={entry.profitLoss >= 0 ? 'positive' : 'negative'}
                  >
                    {entry.profitLoss >= 0 ? '+' : ''}${entry.profitLoss.toFixed(2)}
                    {entry.profitLossPercent && ` (${entry.profitLossPercent >= 0 ? '+' : ''}${entry.profitLossPercent.toFixed(1)}%)`}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.thesis}>
              <div className={styles.thesisLabel}>📍 Edge</div>
              <p className={styles.thesisText}>{entry.edge}</p>
            </div>

            <div className={styles.thesis}>
              <div className={styles.thesisLabel}>💡 Thesis</div>
              <p className={styles.thesisText}>{entry.thesis}</p>
            </div>

            <div className={styles.entryFooter}>
              <span className={styles.date}>
                Entered {formatDate(entry.entryDate)}
              </span>
              <div className={styles.actions}>
                <button
                  className={styles.actionButton}
                  onClick={() => onEditEntry(entry.id)}
                >
                  Edit
                </button>
                <button
                  className={styles.actionButton}
                  onClick={() => handleDelete(entry.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {entry.tags && entry.tags.length > 0 && (
              <div className={styles.tags}>
                {entry.tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredEntries.length === 0 && entries.length > 0 && (
        <div className={styles.noResults}>
          <p>No entries match your filters</p>
        </div>
      )}
    </div>
  );
}
