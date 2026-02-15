import type { NextApiRequest, NextApiResponse } from 'next';

interface SearchResult {
  events: Array<{
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
  }>;
  markets: Array<{
    id: string;
    question: string;
    slug: string;
    outcomePrices: string;
    outcomes: string;
    image?: string;
    volume?: number;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchParams = new URLSearchParams({
      q: q,
      limit_per_type: '8',
      search_tags: 'false',
      search_profiles: 'false',
    });

    const response = await fetch(
      `https://gamma-api.polymarket.com/public-search?${searchParams.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform and return the results
    const result: SearchResult = {
      events: (data.events || []).map((event: any) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        image: event.image,
        liquidity: event.liquidity,
        volume: event.volume,
        markets: event.markets?.map((m: any) => ({
          id: m.id,
          question: m.question,
          slug: m.slug,
          outcomePrices: m.outcomePrices,
          outcomes: m.outcomes,
        })),
      })),
      markets: (data.markets || []).map((market: any) => ({
        id: market.id,
        question: market.question,
        slug: market.slug,
        outcomePrices: market.outcomePrices,
        outcomes: market.outcomes,
        image: market.image,
        volume: market.volume,
      })),
    };

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message || 'Search failed' });
  }
}
