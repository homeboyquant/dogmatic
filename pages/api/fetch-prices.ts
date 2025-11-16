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
        // Try fetching by market slug first
        let data = [];
        let response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${position.marketSlug}`);
        data = await response.json();

        // If slug doesn't work and we have a marketId, try fetching by ID
        if ((!data || data.length === 0) && position.marketId) {
          console.log(`⚠️ Slug lookup failed for ${position.marketSlug}, trying marketId: ${position.marketId}`);
          response = await fetch(`https://gamma-api.polymarket.com/markets?id=${position.marketId}`);
          data = await response.json();
        }

        if (data.length > 0) {
          const market = data[0];
          let priceFound = false;

          // Priority 1: Use bestBid/bestAsk from market data (most reliable)
          if (market.bestBid !== undefined && market.bestAsk !== undefined) {
            let sellPrice;
            if (position.outcome === 'yes') {
              sellPrice = parseFloat(market.bestBid);
            } else {
              sellPrice = 1 - parseFloat(market.bestAsk);
            }
            priceMap[position.id] = sellPrice;
            console.log(`✅ ${position.marketQuestion} (${position.outcome}): bestBid/ask sell price=${sellPrice.toFixed(3)}`);
            priceFound = true;
          }

          // Priority 2: Fallback to orderbook if bestBid not available
          if (!priceFound && market.clobTokenIds && position.marketId) {
            try {
              const tokenIds = typeof market.clobTokenIds === 'string'
                ? JSON.parse(market.clobTokenIds)
                : market.clobTokenIds;

              const tokenIndex = position.outcome === 'yes' ? 0 : 1;
              const tokenId = tokenIds[tokenIndex];

              if (tokenId) {
                const obResponse = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`);
                if (obResponse.ok) {
                  const orderbook = await obResponse.json();
                  if (orderbook.bids && orderbook.bids.length > 0) {
                    const obPrice = parseFloat(orderbook.bids[0].price);
                    priceMap[position.id] = obPrice;
                    console.log(`✅ ${position.marketQuestion} (${position.outcome}): orderbook fallback bid=${obPrice}`);
                    priceFound = true;
                  }
                }
              }
            } catch (obError) {
              console.log(`⚠️ Orderbook not available for ${position.marketQuestion}`);
            }
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
