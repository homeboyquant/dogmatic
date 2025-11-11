import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    limit = '100',
    offset = '0',
    closed = 'false',
    tag_id,
    slug,
    order = 'id',
    ascending = 'false'
  } = req.query;

  try {
    const apiUrl = 'https://gamma-api.polymarket.com';

    // If slug is provided, use the slug endpoint
    if (slug) {
      const response = await fetch(`${apiUrl}/events?slug=${slug}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      res.status(200).json(data);
      return;
    }

    // Build query string for regular event search
    const params = new URLSearchParams({
      limit: limit as string,
      offset: offset as string,
      closed: closed as string,
      order: order as string,
      ascending: ascending as string,
    });

    if (tag_id) {
      params.append('tag_id', tag_id as string);
    }

    const response = await fetch(`${apiUrl}/events?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}
