import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, token_id, amount_usd, order_id, sell_percentage } = req.body;

  try {
    if (action === 'buy') {
      console.log(`🔵 API: Executing BUY - token_id: ${token_id}, amount: $${amount_usd}`);

      const response = await axios.post(`${API_BASE_URL}/buy_fast`, {
        token_id,
        amount_usd
      }, { timeout: 120000 });

      console.log('✅ API: Buy successful:', response.data);
      return res.status(200).json(response.data);

    } else if (action === 'sell') {
      console.log(`🔴 API: Executing SELL - token_id: ${token_id}, order_id: ${order_id}, percentage: ${sell_percentage}%`);

      const response = await axios.post(`${API_BASE_URL}/sell_fast`, {
        token_id,
        order_id,
        sell_percentage
      });

      console.log('✅ API: Sell successful:', response.data);
      return res.status(200).json(response.data);

    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "buy" or "sell"' });
    }

  } catch (error: any) {
    console.error(`❌ API: Trade failed:`, error?.response?.data || error.message);
    return res.status(500).json({
      status: 'failed',
      error: error?.response?.data || error.message
    });
  }
}
