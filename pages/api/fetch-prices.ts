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
      if (!position.marketSlug) {
        priceMap[position.id] = position.entryPrice;
        continue;
      }

      try {
        const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${position.marketSlug}`);
        const data = await response.json();

        if (data.length > 0) {
          const market = data[0];
          const outcomeIndex = position.outcome === 'yes' ? 0 : 1;
          const prices = JSON.parse(market.outcomePrices);
          const newPrice = parseFloat(prices[outcomeIndex]);
          priceMap[position.id] = newPrice;
        } else {
          priceMap[position.id] = position.entryPrice;
        }
      } catch (error) {
        console.error('Error fetching price for', position.marketSlug, ':', error);
        priceMap[position.id] = position.entryPrice;
      }
    }

    res.status(200).json({ success: true, prices: priceMap });
  } catch (error) {
    console.error('Error in fetch-prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
}
