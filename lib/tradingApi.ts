import axios from 'axios';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

export interface ApiResponse {
  status: string;
  response?: any;
  order_id?: string;
  token_id?: string;
  amount?: number;
  price?: number;
  error?: string;
}

/**
 * Buy fast - 1 cent more expensive, but pretty fast entries
 */
export async function buy_fast(token_id: string, amount_usd: number): Promise<ApiResponse> {
  try {
    console.log(`🔵 Attempting to buy: token_id=${token_id}, amount=$${amount_usd}`);

    // Use our proxy API route to avoid CORS issues
    const response = await axios.post('/api/trade', {
      action: 'buy',
      token_id,
      amount_usd
    }, { timeout: 120000 });

    console.log('✅ Buy response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Buy order failed:`, error?.response?.data || error.message);
    throw new Error(`Buy order failed: ${error?.response?.data?.error || error.message}`);
  }
}

/**
 * Sell fast
 */
export async function sell_fast(token_id: string, order_id: string, sell_percentage: number): Promise<ApiResponse> {
  try {
    console.log(`🔴 Attempting to sell: token_id=${token_id}, order_id=${order_id}, percentage=${sell_percentage}%`);

    // Use our proxy API route to avoid CORS issues
    const response = await axios.post('/api/trade', {
      action: 'sell',
      token_id,
      order_id,
      sell_percentage
    });

    console.log('✅ Sell response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Sell limit order failed:`, error?.response?.data || error.message);
    return { status: "failed", response: error?.toString() };
  }
}

/**
 * Get user orders using private key
 */
export async function getUserOrders(privateKey: string): Promise<any[]> {
  try {
    console.log('📖 Fetching user orders...');
    const response = await axios.get(`${API_BASE_URL}/user/orders`, {
      headers: {
        'Authorization': `Bearer ${privateKey}`
      }
    });
    console.log('✅ User orders retrieved:', response.data);
    return response.data.orders || [];
  } catch (error: any) {
    console.error(`❌ Failed to get user orders:`, error?.response?.data || error.message);
    return [];
  }
}

/**
 * Get token ID for a market slug and outcome
 */
export async function getTokenIdForMarket(slug: string, outcome: 'YES' | 'NO'): Promise<string | null> {
  try {
    console.log(`🔍 Fetching token ID for ${slug} - ${outcome}`);

    // Fetch market data from Polymarket
    const response = await axios.get(`https://gamma-api.polymarket.com/markets`, {
      params: {
        slug: slug,
        active: true
      }
    });

    if (response.data && response.data.length > 0) {
      const market = response.data[0];

      // Get token IDs from clobTokenIds array
      if (market.clobTokenIds && market.clobTokenIds.length >= 2) {
        const tokenId = outcome === 'YES' ? market.clobTokenIds[0] : market.clobTokenIds[1];
        console.log(`✅ Found token ID: ${tokenId} for ${outcome}`);
        return tokenId;
      }

      // Alternative: get from tokens array
      if (market.tokens && market.tokens.length >= 2) {
        const token = market.tokens.find((t: any) => t.outcome.toUpperCase() === outcome);
        if (token) {
          console.log(`✅ Found token ID: ${token.token_id} for ${outcome}`);
          return token.token_id;
        }
      }
    }

    console.error(`❌ No token ID found for ${slug} - ${outcome}`);
    return null;
  } catch (error: any) {
    console.error(`❌ Error fetching token ID:`, error?.response?.data || error.message);
    return null;
  }
}
