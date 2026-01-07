import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const TRADING_API_URL = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

/**
 * Get order details from trading API
 *
 * This endpoint retrieves details for a specific order using the trading API's /order endpoint.
 *
 * Required parameters:
 * - order_id: The ID of the order to retrieve
 *
 * Returns:
 * Order details including status, size, price, etc.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'Missing required field: order_id' });
    }

    console.log(`📋 Fetching order details - order_id: ${order_id}`);

    // Call the trading API /order endpoint
    const response = await axios.post(`${TRADING_API_URL}/order`, {
      order_id
    });

    console.log('✅ Order details fetched:', response.data);
    return res.status(200).json(response.data);

  } catch (error: any) {
    console.error('❌ Error fetching order:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to fetch order',
      details: error.response?.data || error.message,
    });
  }
}
