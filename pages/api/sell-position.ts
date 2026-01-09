import type { NextApiRequest, NextApiResponse } from 'next';

const TRADING_API_URL = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token_id, sell_percentage, order_id: providedOrderId } = req.body;

    if (!token_id || !sell_percentage) {
      return res.status(400).json({ error: 'Missing required fields: token_id, sell_percentage' });
    }

    console.log('🔴 Selling position:', { token_id, sell_percentage, order_id: providedOrderId });

    let order_id = providedOrderId;

    // Step 1: Get order_id if not provided
    if (!order_id) {
      console.log('🔍 Fetching order_id...');

      const orderIdResponse = await fetch(`${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/api/get-order-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token_id }),
      });

      if (!orderIdResponse.ok) {
        const errorData = await orderIdResponse.json();
        throw new Error(`Failed to fetch order_id: ${errorData.error || 'Unknown error'}`);
      }

      const orderIdData = await orderIdResponse.json();
      order_id = orderIdData.order_id;

      console.log('🎯 Found order_id:', order_id);
    } else {
      console.log('✅ Using provided order_id:', order_id);
    }

    // Step 2: Call homeboyapi sell with the order_id
    console.log('📤 Calling homeboyapi sell...');
    const sellResponse = await fetch(`${TRADING_API_URL}/sell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token_id,
        order_id,
        sell_percentage
      }),
    });

    const sellData = await sellResponse.json();
    console.log('✅ Sell response:', sellData);

    // Normalize the response format
    // Homeboy API returns: {status: "success", response: {success: true, errorMsg: "", ...}}
    const isSuccess = sellData.status === 'success' &&
                     sellData.response?.success === true &&
                     (!sellData.response?.errorMsg || sellData.response.errorMsg === '');

    return res.status(200).json({
      success: isSuccess,
      status: sellData.status,
      response: sellData.response,
      error: sellData.response?.errorMsg || null,
      orderID: sellData.response?.orderID,
      size_matched: sellData.response?.size_matched,
      actual_status: sellData.response?.actual_status
    });
  } catch (error: any) {
    console.error('❌ Error selling position:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}
