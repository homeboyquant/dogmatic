import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './MarketSearch.module.css';

interface SearchEvent {
  id: string;
  title: string;
  slug: string;
  image?: string;
  liquidity?: number;
  volume?: number;
  markets?: Array<{
    id: string;
    question: string;
    slug: string;
    outcomePrices: string;
    outcomes: string;
  }>;
}

interface SearchMarket {
  id: string;
  question: string;
  slug: string;
  outcomePrices: string;
  outcomes: string;
  image?: string;
  volume?: number;
}

interface SearchResults {
  events: SearchEvent[];
  markets: SearchMarket[];
}

interface MarketSearchProps {
  onSelectEvent: (slug: string) => void;
  placeholder?: string;
}

export default function MarketSearch({ onSelectEvent, placeholder = "Search markets..." }: MarketSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults(null);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAllItems = () => {
    if (!results) return [];
    const items: Array<{ type: 'event' | 'market'; data: SearchEvent | SearchMarket }> = [];
    results.events.forEach(event => items.push({ type: 'event', data: event }));
    results.markets.forEach(market => items.push({ type: 'market', data: market }));
    return items;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = getAllItems();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        handleSelect(selectedItem.data.slug);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (slug: string) => {
    setQuery('');
    setIsOpen(false);
    setResults(null);
    onSelectEvent(slug);
  };

  const formatVolume = (volume?: number) => {
    if (!volume) return '';
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const getPrice = (outcomePrices: string) => {
    try {
      const prices = JSON.parse(outcomePrices);
      return Math.round(parseFloat(prices[0]) * 100);
    } catch {
      return null;
    }
  };

  const hasResults = results && (results.events.length > 0 || results.markets.length > 0);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {isLoading && (
          <div className={styles.spinner}>
            <div className={styles.spinnerInner} />
          </div>
        )}
        {query && !isLoading && (
          <button
            className={styles.clearButton}
            onClick={() => {
              setQuery('');
              setResults(null);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          {!hasResults && !isLoading && (
            <div className={styles.noResults}>
              <svg className={styles.noResultsIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span>No markets found for "{query}"</span>
            </div>
          )}

          {results?.events && results.events.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Events</span>
                <span className={styles.sectionCount}>{results.events.length}</span>
              </div>
              {results.events.map((event, index) => (
                <div
                  key={event.id}
                  className={`${styles.item} ${selectedIndex === index ? styles.selected : ''}`}
                  onClick={() => handleSelect(event.slug)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={styles.itemImageWrapper}>
                    {event.image ? (
                      <img src={event.image} alt="" className={styles.itemImage} />
                    ) : (
                      <div className={styles.itemImagePlaceholder}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>{event.title}</div>
                    <div className={styles.itemMeta}>
                      {event.markets && (
                        <span className={styles.marketCount}>
                          {event.markets.length} market{event.markets.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {event.volume && (
                        <span className={styles.volume}>{formatVolume(event.volume)} vol</span>
                      )}
                    </div>
                  </div>
                  <svg className={styles.itemArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              ))}
            </div>
          )}

          {results?.markets && results.markets.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Markets</span>
                <span className={styles.sectionCount}>{results.markets.length}</span>
              </div>
              {results.markets.map((market, index) => {
                const itemIndex = (results?.events?.length || 0) + index;
                const yesPrice = getPrice(market.outcomePrices);
                return (
                  <div
                    key={market.id}
                    className={`${styles.item} ${selectedIndex === itemIndex ? styles.selected : ''}`}
                    onClick={() => handleSelect(market.slug)}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                  >
                    <div className={styles.itemImageWrapper}>
                      {market.image ? (
                        <img src={market.image} alt="" className={styles.itemImage} />
                      ) : (
                        <div className={styles.itemImagePlaceholder}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 3v18h18" />
                            <path d="M18 9l-5 5-4-4-3 3" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>{market.question}</div>
                      <div className={styles.itemMeta}>
                        {yesPrice !== null && (
                          <span className={styles.price}>
                            <span className={styles.priceYes}>{yesPrice}%</span>
                            <span className={styles.priceDivider}>/</span>
                            <span className={styles.priceNo}>{100 - yesPrice}%</span>
                          </span>
                        )}
                        {market.volume && (
                          <span className={styles.volume}>{formatVolume(market.volume)} vol</span>
                        )}
                      </div>
                    </div>
                    <svg className={styles.itemArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.footer}>
            <span>Press</span>
            <kbd className={styles.kbd}>↵</kbd>
            <span>to select</span>
            <span className={styles.footerDivider}>•</span>
            <kbd className={styles.kbd}>↑↓</kbd>
            <span>to navigate</span>
            <span className={styles.footerDivider}>•</span>
            <kbd className={styles.kbd}>esc</kbd>
            <span>to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
