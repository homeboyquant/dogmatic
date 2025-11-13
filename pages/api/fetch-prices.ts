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

          // Calculate expected price from market bestBid/bestAsk first
          let expectedPrice = 0;
          if (market.bestBid !== undefined && market.bestAsk !== undefined) {
            if (position.outcome === 'yes') {
              expectedPrice = parseFloat(market.bestBid);
            } else {
              expectedPrice = 1 - parseFloat(market.bestAsk);
            }
          }

          // Priority 1: Try orderbook, but validate against market bestBid
          if (market.clobTokenIds && position.marketId) {
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

                    // Compare orderbook price with expected market price
                    if (expectedPrice > 0) {
                      const priceDiff = Math.abs(obPrice - expectedPrice);
                      const percentDiff = (priceDiff / expectedPrice) * 100;

                      // If difference is > 10%, use market bestBid instead
                      if (percentDiff > 10) {
                        console.log(`⚠️ Orderbook price (${obPrice}) differs from market bestBid (${expectedPrice.toFixed(3)}) by ${percentDiff.toFixed(1)}% - using bestBid`);
                        priceMap[position.id] = expectedPrice;
                        priceFound = true;
                      } else {
                        priceMap[position.id] = obPrice;
                        console.log(`✅ ${position.marketQuestion} (${position.outcome}): orderbook bid=${obPrice}`);
                        priceFound = true;
                      }
                    } else {
                      // No market price to compare, use orderbook
                      priceMap[position.id] = obPrice;
                      console.log(`✅ ${position.marketQuestion} (${position.outcome}): orderbook bid=${obPrice}`);
                      priceFound = true;
                    }
                  }
                }
              }
            } catch (obError) {
              console.log(`⚠️ Orderbook not available for ${position.marketQuestion}`);
            }
          }

          // Priority 2: Use bestBid/bestAsk from market data if orderbook failed
          if (!priceFound && expectedPrice > 0) {
            priceMap[position.id] = expectedPrice;
            console.log(`✅ ${position.marketQuestion} (${position.outcome}): market sell price=${expectedPrice.toFixed(3)}`);
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
