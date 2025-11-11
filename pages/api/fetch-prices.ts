import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { positions } = req.body;

    if (!Array.isArray(positions)) {
      return res.status(400).json({ error: 'Invalid positions data' });
    }

    const priceMap: Record<string, number> = {};

    for (const position of positions) {
      const fallbackPrice = position.avgPrice || position.currentPrice || 0;

      if (!position.marketSlug) {
        priceMap[position.id] = fallbackPrice;
        continue;
      }

      try {
        // Fetch market data directly using market slug
        const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${position.marketSlug}`);
        const data = await response.json();

        if (data.length > 0) {
          const market = data[0];

          if (market && market.bestBid !== undefined) {
            // Always use bestBid for current value (what you can sell for right now)
            // This applies to both YES and NO positions
            const newPrice = parseFloat(market.bestBid);
            priceMap[position.id] = newPrice;
            console.log(`✅ ${position.marketQuestion}: bestBid=$${newPrice}`);
          } else {
            // Fallback to entry price if no bid/ask available
            priceMap[position.id] = fallbackPrice;
          }
        } else {
          priceMap[position.id] = fallbackPrice;
        }
      } catch (error) {
        console.error('Error fetching price for', position.marketSlug, ':', error);
        priceMap[position.id] = fallbackPrice;
      }
    }

    res.status(200).json({ success: true, prices: priceMap });
  } catch (error) {
    console.error('Error in fetch-prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
}
