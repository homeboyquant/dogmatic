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
          let priceFound = false;

          // Priority 1: Try to get orderbook price (most accurate for active markets)
          if (market.clobTokenIds && position.marketId) {
            try {
              const tokenIds = typeof market.clobTokenIds === 'string'
                ? JSON.parse(market.clobTokenIds)
                : market.clobTokenIds;

              // Get token ID for the position's side
              const tokenIndex = position.outcome === 'yes' ? 0 : 1;
              const tokenId = tokenIds[tokenIndex];

              if (tokenId) {
                const obResponse = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`);
                if (obResponse.ok) {
                  const orderbook = await obResponse.json();
                  // Use best bid (what you can sell for)
                  if (orderbook.bids && orderbook.bids.length > 0) {
                    priceMap[position.id] = parseFloat(orderbook.bids[0].price);
                    console.log(`✅ ${position.marketQuestion} (${position.outcome}): orderbook bid=$${orderbook.bids[0].price}`);
                    priceFound = true;
                  }
                }
              }
            } catch (obError) {
              console.log(`⚠️ Orderbook not available for ${position.marketQuestion}`);
            }
          }

          // Priority 2: Use bestBid from market data if orderbook failed
          if (!priceFound && market.bestBid !== undefined) {
            const newPrice = parseFloat(market.bestBid);
            priceMap[position.id] = newPrice;
            console.log(`✅ ${position.marketQuestion}: bestBid=$${newPrice}`);
            priceFound = true;
          }

          // Priority 3: Use outcomePrices (for resolved/closed markets)
          if (!priceFound && market.outcomePrices) {
            const prices = JSON.parse(market.outcomePrices);
            const priceIndex = position.outcome === 'yes' ? 0 : 1;
            const outcomePrice = parseFloat(prices[priceIndex]);
            priceMap[position.id] = outcomePrice;
            console.log(`✅ ${position.marketQuestion} (${position.outcome}): outcomePrice=$${outcomePrice} (market likely resolved)`);
            priceFound = true;
          }

          // Final fallback: use entry price
          if (!priceFound) {
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
