import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { token_id } = req.query;

  if (!token_id || typeof token_id !== 'string') {
    return res.status(400).json({ error: 'token_id is required' });
  }

  try {
    const apiUrl = 'https://clob.polymarket.com';
    const response = await fetch(`${apiUrl}/book?token_id=${token_id}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching orderbook:', error);
    res.status(500).json({ error: 'Failed to fetch orderbook' });
  }
}
