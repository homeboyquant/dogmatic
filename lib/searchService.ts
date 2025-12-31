/**
 * Polymarket Public Search Service
 * Uses the public-search API endpoint for text-based market searching
 */

export interface SearchMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  liquidity: string;
  volume: string;
  active: boolean;
  closed: boolean;
  outcomes: string;
  outcomePrices: string;
  clobTokenIds?: string[];
  bestBid?: string;
  bestAsk?: string;
  lastTradePrice?: string;
}

export interface SearchEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  volume: number;
  liquidity: number;
  markets: SearchMarket[];
}

export interface SearchResult {
  events: SearchEvent[];
  tags?: any[];
  profiles?: any[];
  pagination?: {
    hasMore: boolean;
    totalResults: number;
  };
}

class SearchService {
  /**
   * Search for markets and events using text query
   * Uses Next.js API route to avoid CORS issues
   */
  async searchMarkets(query: string, limit: number = 10): Promise<SearchResult> {
    try {
      if (!query.trim()) {
        return { events: [] };
      }

      // Use Next.js API route as proxy to avoid CORS
      const url = `/api/search-markets?q=${encodeURIComponent(query)}&limit_per_type=${limit}`;

      console.log('🔍 Searching Polymarket:', query);

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Search API error:', errorData);
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ Search results:', data.events?.length || 0, 'events found');

      return data as SearchResult;
    } catch (error) {
      console.error('❌ Search error:', error);
      return { events: [] };
    }
  }

  /**
   * Get event by slug (for backward compatibility)
   */
  async getEventBySlug(slug: string): Promise<SearchEvent | null> {
    try {
      const results = await this.searchMarkets(slug, 1);

      // Try to find exact slug match
      const exactMatch = results.events?.find(e => e.slug === slug);
      if (exactMatch) return exactMatch;

      // Otherwise return first result
      return results.events?.[0] || null;
    } catch (error) {
      console.error('❌ Error fetching event by slug:', error);
      return null;
    }
  }
}

export const searchService = new SearchService();
