import { useState, useEffect, useRef } from 'react';
import { Event } from '@/types/polymarket';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onSelectEvent: (event: Event) => void;
}

export default function SearchBar({ onSelectEvent }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Event[]>([]);
  const [recommendations, setRecommendations] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch recommendations on mount
  useEffect(() => {
    const fetchRecommendations = async () => {
      console.log('🔍 Fetching recommendations...');
      try {
        const response = await fetch('/api/events?limit=50&closed=false');
        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Raw data received:', data.length, 'events');

        if (Array.isArray(data)) {
          const filtered = data
            .filter((event: Event) => !event.archived && !event.closed && event.active)
            .slice(0, 8);

          console.log('✅ Filtered recommendations:', filtered.length, 'events');
          console.log('📋 First recommendation:', filtered[0]?.title);
          setRecommendations(filtered);
        }
      } catch (error) {
        console.error('❌ Error fetching recommendations:', error);
        // Set empty array on error so app still works
        setRecommendations([]);
      }
    };

    fetchRecommendations();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchEvents = async () => {
      if (query.length === 0) {
        setResults([]);
        return;
      }

      if (query.length < 2) {
        setResults([]);
        return;
      }

      console.log(`🔎 Searching for: "${query}"`);
      setLoading(true);
      try {
        // Fetch more events for better search results
        const response = await fetch('/api/events?limit=200&closed=false');
        console.log('📡 Search response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Search data received:', data.length, 'events');

        if (Array.isArray(data)) {
          // Filter by query and exclude archived events
          const filtered = data
            .filter((event: Event) =>
              !event.archived &&
              !event.closed &&
              event.active &&
              event.title.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 10); // Limit to 10 results

          console.log(`✅ Found ${filtered.length} results for "${query}"`);
          if (filtered.length > 0) {
            console.log('📋 First result:', filtered[0].title);
          } else {
            console.log('⚠️ No matching events found');
          }
          setResults(filtered);
        }
      } catch (error) {
        console.error('❌ Error searching events:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchEvents, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelectEvent = (event: Event) => {
    setQuery(event.title);
    setShowDropdown(false);
    onSelectEvent(event);
  };

  const handleSearch = () => {
    if (query.length >= 2 && results.length > 0) {
      handleSelectEvent(results[0]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const displayList = query.length >= 2 ? results : recommendations;
  const shouldShowDropdown = showDropdown && displayList.length > 0;

  return (
    <div className={styles.searchWrapper} ref={searchRef}>
      <div className={styles.searchBox}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 14L11.1 11.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search markets or events..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onKeyPress={handleKeyPress}
        />
        {loading ? (
          <div className={styles.loader}>⋯</div>
        ) : (
          query.length >= 2 && (
            <button
              className={styles.searchButton}
              onClick={handleSearch}
              type="button"
              aria-label="Search"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 14L11.1 11.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )
        )}
      </div>

      {shouldShowDropdown && (
        <div className={styles.dropdown}>
          {query.length < 2 && recommendations.length > 0 && (
            <div className={styles.dropdownHeader}>
              <span className={styles.headerIcon}>💡</span>
              <span className={styles.headerText}>Recommended Markets</span>
            </div>
          )}

          {displayList.map((event) => (
            <div
              key={event.id}
              className={styles.dropdownItem}
              onClick={() => handleSelectEvent(event)}
            >
              <div className={styles.marketQuestion}>{event.title}</div>
              <div className={styles.marketMeta}>
                {event.volume24hr > 0 && (
                  <span className={styles.volume}>
                    ${event.volume24hr.toLocaleString(undefined, { maximumFractionDigits: 0 })} 24h
                  </span>
                )}
                {event.active && <span className={styles.statusBadge}>ACTIVE</span>}
                {event.markets && event.markets.length > 1 && (
                  <span className={styles.marketCount}>{event.markets.length} markets</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
