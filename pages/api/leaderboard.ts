import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { window = '7d', limit = '10' } = req.query;

    const url = `https://data-api.polymarket.com/v1/leaderboard?window=${window}&limit=${limit}`;

    console.log('🏆 Fetching leaderboard:', url);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Polymarket API error:', errorText);
      return res.status(response.status).json({ error: 'Leaderboard fetch failed', details: errorText });
    }

    const data = await response.json();

    console.log('✅ Leaderboard results:', data.length, 'traders');

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('❌ Leaderboard proxy error:', error);
    return res.status(500).json({
      error: 'Failed to fetch leaderboard',
      details: error.message,
    });
  }
}
