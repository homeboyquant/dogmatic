import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { q, limit_per_type = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(q)}&limit_per_type=${limit_per_type}`;

    console.log('🔍 Proxying search to Polymarket:', q);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Polymarket API error:', errorText);
      return res.status(response.status).json({ error: 'Search failed', details: errorText });
    }

    const data = await response.json();

    console.log('✅ Search results:', data.events?.length || 0, 'events');

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('❌ Search proxy error:', error);
    return res.status(500).json({
      error: 'Failed to search markets',
      details: error.message,
    });
  }
}
