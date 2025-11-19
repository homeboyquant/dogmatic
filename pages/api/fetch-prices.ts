import type { NextApiRequest, NextApiResponse } from 'next';

// Validation function to check if price is reasonable
function isValidPrice(price: number): boolean {
  return !isNaN(price) && isFinite(price) && price >= 0 && price <= 1;
}

// Sanity check for price changes
function isPriceChangeReasonable(oldPrice: number, newPrice: number): { valid: boolean; warning?: string } {
  if (!isValidPrice(newPrice)) {
    return { valid: false, warning: 'Invalid price range (must be 0-1)' };
  }

  // Allow any price for first-time fetch
  if (!oldPrice || oldPrice === 0) {
    return { valid: true };
  }

  // Check for suspicious price drops (>95% drop)
  const percentChange = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
  if (percentChange > 95 && newPrice < 0.05) {
    return { valid: true, warning: `Suspicious price drop: ${oldPrice.toFixed(3)} → ${newPrice.toFixed(3)} (${percentChange.toFixed(1)}% change)` };
  }

  return { valid: true };
}

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
    const warnings: string[] = [];

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

          // Priority 1: Check outcomePrices first for definitive results (near 0 or near 1)
          // This catches resolved markets that aren't marked as closed yet
          console.log(`🔍 Market status for ${position.marketQuestion}: closed=${market.closed}, resolved=${market.resolved}, hasOutcomePrices=${!!market.outcomePrices}`);

          if (market.outcomePrices) {
            try {
              const prices = JSON.parse(market.outcomePrices);
              const priceIndex = position.outcome === 'yes' ? 0 : 1;
              const outcomePrice = parseFloat(prices[priceIndex]);

              console.log(`📊 OutcomePrices for ${position.marketQuestion}: ${market.outcomePrices}, calculated price for ${position.outcome}=${outcomePrice}`);

              // If outcomePrices shows definitive result (< 0.01 or > 0.99), use it immediately
              if (isValidPrice(outcomePrice) && (outcomePrice < 0.01 || outcomePrice > 0.99)) {
                const validation = isPriceChangeReasonable(position.currentPrice, outcomePrice);
                if (validation.warning) {
                  warnings.push(`${position.marketQuestion} (${position.outcome}): ${validation.warning}`);
                }
                priceMap[position.id] = outcomePrice;
                console.log(`✅ ${position.marketQuestion} (${position.outcome}): DEFINITIVE outcomePrice=$${outcomePrice.toFixed(4)} (${outcomePrice < 0.01 ? 'lost' : 'won'})`);
                priceFound = true;
              }
            } catch (e) {
              console.warn(`⚠️ Failed to parse outcomePrices for ${position.marketQuestion}`);
            }
          }

          // Priority 2: Use outcomePrices for explicitly closed/resolved markets (any price)
          if (!priceFound && (market.closed || market.resolved) && market.outcomePrices) {
            try {
              const prices = JSON.parse(market.outcomePrices);
              const priceIndex = position.outcome === 'yes' ? 0 : 1;
              const outcomePrice = parseFloat(prices[priceIndex]);

              if (isValidPrice(outcomePrice)) {
                const validation = isPriceChangeReasonable(position.currentPrice, outcomePrice);
                if (validation.warning) {
                  warnings.push(`${position.marketQuestion} (${position.outcome}): ${validation.warning}`);
                }
                priceMap[position.id] = outcomePrice;
                console.log(`✅ ${position.marketQuestion} (${position.outcome}): RESOLVED outcomePrice=$${outcomePrice}`);
                priceFound = true;
              } else {
                console.warn(`⚠️ Invalid outcomePrice for ${position.marketQuestion}: ${outcomePrice}`);
              }
            } catch (e) {
              console.warn(`⚠️ Failed to parse outcomePrices for ${position.marketQuestion}`);
            }
          }

          // Priority 3: Use bestBid/bestAsk OR outcomePrices if bestBid doesn't exist
          if (!priceFound) {
            // First try bestBid/bestAsk if available
            if (market.bestBid !== undefined && market.bestAsk !== undefined) {
              let sellPrice;
              if (position.outcome === 'yes') {
                sellPrice = parseFloat(market.bestBid);
              } else {
                sellPrice = 1 - parseFloat(market.bestAsk);
              }

              console.log(`📊 ${position.marketQuestion} (${position.outcome}): bestBid=${market.bestBid}, bestAsk=${market.bestAsk}, calculated sell price=${sellPrice.toFixed(3)}`);

              if (isValidPrice(sellPrice)) {
                const validation = isPriceChangeReasonable(position.currentPrice, sellPrice);
                if (validation.warning) {
                  warnings.push(`${position.marketQuestion} (${position.outcome}): ${validation.warning}`);
                }
                priceMap[position.id] = sellPrice;
                console.log(`✅ ${position.marketQuestion} (${position.outcome}): using bestBid/ask sell price=${sellPrice.toFixed(3)}`);
                priceFound = true;
              } else {
                console.warn(`⚠️ Invalid bestBid/ask price for ${position.marketQuestion}: ${sellPrice}`);
              }
            }

            // If bestBid doesn't exist, use outcomePrices as replacement
            if (!priceFound && market.outcomePrices) {
              try {
                const prices = JSON.parse(market.outcomePrices);
                const priceIndex = position.outcome === 'yes' ? 0 : 1;
                const outcomePrice = parseFloat(prices[priceIndex]);

                if (isValidPrice(outcomePrice)) {
                  const validation = isPriceChangeReasonable(position.currentPrice, outcomePrice);
                  if (validation.warning) {
                    warnings.push(`${position.marketQuestion} (${position.outcome}): ${validation.warning}`);
                  }
                  priceMap[position.id] = outcomePrice;
                  console.log(`✅ ${position.marketQuestion} (${position.outcome}): using outcomePrices (bestBid not available)=$${outcomePrice.toFixed(4)}`);
                  priceFound = true;
                }
              } catch (e) {
                console.warn(`⚠️ Failed to parse outcomePrices for ${position.marketQuestion}`);
              }
            }
          }

          // Priority 4: Fallback to orderbook if bestBid not available
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
                    if (isValidPrice(obPrice)) {
                      const validation = isPriceChangeReasonable(position.currentPrice, obPrice);
                      if (validation.warning) {
                        warnings.push(`${position.marketQuestion} (${position.outcome}): ${validation.warning}`);
                      }
                      priceMap[position.id] = obPrice;
                      console.log(`✅ ${position.marketQuestion} (${position.outcome}): orderbook fallback bid=${obPrice}`);
                      priceFound = true;
                    }
                  }
                }
              }
            } catch (obError) {
              console.log(`⚠️ Orderbook not available for ${position.marketQuestion}`);
            }
          }

          // Priority 5: Use outcomePrices as fallback when bestBid/orderbook unavailable
          if (!priceFound && market.outcomePrices) {
            try {
              const prices = JSON.parse(market.outcomePrices);
              const priceIndex = position.outcome === 'yes' ? 0 : 1;
              const outcomePrice = parseFloat(prices[priceIndex]);
              if (isValidPrice(outcomePrice)) {
                const validation = isPriceChangeReasonable(position.currentPrice, outcomePrice);
                if (validation.warning) {
                  warnings.push(`${position.marketQuestion} (${position.outcome}): ${validation.warning}`);
                }
                priceMap[position.id] = outcomePrice;
                console.log(`✅ ${position.marketQuestion} (${position.outcome}): outcomePrices fallback=$${outcomePrice}`);
                priceFound = true;
              }
            } catch (parseError) {
              console.log(`⚠️ Failed to parse outcomePrices for ${position.marketQuestion}`);
            }
          }

          // Final fallback: use entry price (but log warning)
          if (!priceFound) {
            priceMap[position.id] = fallbackPrice;
            warnings.push(`${position.marketQuestion} (${position.outcome}): No market price available, using entry price $${fallbackPrice.toFixed(3)}`);
            console.log(`⚠️ ${position.marketQuestion} (${position.outcome}): Using entry price fallback=$${fallbackPrice.toFixed(3)}`);
          }
        } else {
          priceMap[position.id] = fallbackPrice;
        }
      } catch (error) {
        console.error('Error fetching price for', position.marketSlug, ':', error);
        priceMap[position.id] = fallbackPrice;
      }
    }

    // Cross-validate ALL prices by checking outcomePrices (to catch resolved markets not marked as closed)
    console.log('🔍 Cross-validating all prices with outcomePrices...');
    for (const position of positions) {
      const price = priceMap[position.id];

      // Cross-validate all prices, especially those that might be wrong
      if (price !== undefined && position.marketSlug) {
        try {
          const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${position.marketSlug}`);
          const data = await response.json();

          if (data.length > 0) {
            const market = data[0];

            if (market.outcomePrices) {
              const prices = JSON.parse(market.outcomePrices);
              const priceIndex = position.outcome === 'yes' ? 0 : 1;
              const outcomePrice = parseFloat(prices[priceIndex]);

              // If outcomePrices differs significantly from our price (> 10%), use outcomePrices
              // This catches cases where bestBid/ask is stale but outcomePrices is correct
              const priceDiff = Math.abs(price - outcomePrice);
              const percentDiff = price > 0 ? (priceDiff / price) * 100 : 0;

              if (priceDiff > 0.05 || percentDiff > 10) {
                console.log(`⚠️ Price mismatch for ${position.marketQuestion} (${position.outcome}): bestBid/ask=$${price.toFixed(3)} vs outcomePrices=$${outcomePrice.toFixed(3)}. Using outcomePrices.`);
                priceMap[position.id] = outcomePrice;
              } else {
                console.log(`✓ Price validated for ${position.marketQuestion} (${position.outcome}): $${price.toFixed(3)} matches outcomePrices`);
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Cross-validation failed for ${position.marketQuestion}`);
        }
      }
    }

    // Log warnings for debugging, but don't send to UI
    if (warnings.length > 0) {
      console.warn(`⚠️ Price fetch warnings (${warnings.length}):`, warnings);
    }

    res.status(200).json({ success: true, prices: priceMap });
  } catch (error) {
    console.error('Error in fetch-prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
}
